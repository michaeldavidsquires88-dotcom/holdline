const express = require('express');
const twilio = require('twilio');
const VoiceResponse = twilio.twiml.VoiceResponse;
const config = require('./config');
const { chat, getOpeningGreeting } = require('./ai');
const { getSession, saveSession, addMessage } = require('./sessions');
const { notifyContractor } = require('./sms');
const { isEmergency } = require('./emergency');

const router = express.Router();

/**
 * POST /voice/incoming
 * Called by Twilio when a call comes in
 */
router.post('/incoming', async (req, res) => {
  const twiml = new VoiceResponse();
  const callSid = req.body.CallSid;
  const callerNumber = req.body.From || 'Unknown';

  console.log(`📞 Incoming call: ${callSid} from ${callerNumber}`);

  // Ring the contractor first
  const ringsBeforeAI = config.business.ringsBeforeAI;
  const ringSeconds = ringsBeforeAI * 6; // ~6 seconds per ring

  // Dial contractor — if no answer, fall through to AI
  const dial = twiml.dial({
    timeout: ringSeconds,
    action: `${config.baseUrl}/voice/no-answer`,
    method: 'POST',
  });
  dial.number(config.business.ownerPhone);

  res.type('text/xml');
  res.send(twiml.toString());
});

/**
 * POST /voice/no-answer
 * Called when contractor doesn't pick up
 */
router.post('/no-answer', async (req, res) => {
  const twiml = new VoiceResponse();
  const callSid = req.body.CallSid;
  const callerNumber = req.body.From || 'Unknown';
  const dialStatus = req.body.DialCallStatus;

  console.log(`📵 No answer (${dialStatus}) for ${callSid} — engaging AI`);

  // Only engage AI if truly no answer (not busy or failed for other reasons)
  if (dialStatus === 'completed') {
    // Contractor actually picked up and hung up — don't engage AI
    res.type('text/xml');
    res.send(twiml.toString());
    return;
  }

  // Brief pause, then AI greeting
  twiml.pause({ length: 1 });

  const greeting = await getOpeningGreeting();

  twiml.gather({
    input: 'speech',
    action: `${config.baseUrl}/voice/ai-response`,
    method: 'POST',
    speechTimeout: 'auto',
    actionOnEmptyResult: true,
  }).say({
    voice: 'Polly.Joanna',
    language: 'en-US',
  }, greeting);

  // Initialize session
  const session = {
    callSid,
    callerNumber,
    messages: [{ role: 'assistant', content: greeting }],
    data: {},
    notified: false,
    turnCount: 1,
    createdAt: new Date().toISOString(),
  };
  saveSession(callSid, session);

  res.type('text/xml');
  res.send(twiml.toString());
});

/**
 * POST /voice/ai-response
 * Processes each speech input and responds
 */
router.post('/ai-response', async (req, res) => {
  const twiml = new VoiceResponse();
  const callSid = req.body.CallSid;
  const callerNumber = req.body.From || 'Unknown';
  const speechResult = req.body.SpeechResult || '';
  const confidence = parseFloat(req.body.Confidence || '0');

  console.log(`🎤 [${callSid}] Customer said: "${speechResult}" (confidence: ${confidence})`);

  let session = getSession(callSid);

  // Safety: max turns to prevent runaway calls
  if (session.turnCount > 12) {
    twiml.say({ voice: 'Polly.Joanna' },
      'Thank you for calling. We have all your information and will be in touch shortly. Goodbye!');
    twiml.hangup();
    res.type('text/xml');
    return res.send(twiml.toString());
  }

  // Handle empty/unclear speech
  if (!speechResult || confidence < 0.3) {
    const gather = twiml.gather({
      input: 'speech',
      action: `${config.baseUrl}/voice/ai-response`,
      method: 'POST',
      speechTimeout: 'auto',
      actionOnEmptyResult: true,
    });
    gather.say({ voice: 'Polly.Joanna' },
      "I'm sorry, I didn't catch that. Could you repeat that please?");
    res.type('text/xml');
    return res.send(twiml.toString());
  }

  // Quick emergency check — send SMS immediately if emergency keywords detected
  const quickEmergency = isEmergency(speechResult);

  // Add customer message to history
  addMessage(session, 'user', speechResult);

  // Get AI response
  const { visibleText, data, error } = await chat(session.messages);

  if (error) {
    // Fallback to voicemail
    twiml.say({ voice: 'Polly.Joanna' },
      "I'm sorry, I'm experiencing a technical issue. Please leave a message after the tone.");
    twiml.record({
      action: `${config.baseUrl}/voice/voicemail`,
      method: 'POST',
      maxLength: 120,
      transcribe: true,
      transcribeCallback: `${config.baseUrl}/voice/transcription`,
    });
    res.type('text/xml');
    return res.send(twiml.toString());
  }

  // Add AI response to history
  addMessage(session, 'assistant', visibleText);

  // Merge collected data
  if (data) {
    session.data = { ...session.data, ...data };
    // Override isEmergency if quick keyword check caught it
    if (quickEmergency) session.data.isEmergency = true;
  }

  saveSession(callSid, session);

  // Notify contractor if conversation is complete or emergency detected
  const shouldNotify =
    !session.notified &&
    (session.data.type === 'complete' || session.data.type === 'emergency' ||
     session.data.isEmergency ||
     (session.data.callerName && session.turnCount >= 4));

  if (shouldNotify) {
    try {
      await notifyContractor(session.data, callerNumber);
      session.notified = true;
      saveSession(callSid, session);
    } catch (err) {
      console.error('Failed to notify contractor:', err.message);
    }
  }

  // Determine if conversation should end
  const isDone = session.data.type === 'complete' ||
    session.data.type === 'emergency' ||
    session.turnCount >= 10;

  if (isDone) {
    twiml.say({ voice: 'Polly.Joanna' }, visibleText);
    twiml.pause({ length: 1 });
    twiml.say({ voice: 'Polly.Joanna' }, 'Goodbye!');
    twiml.hangup();
  } else {
    const gather = twiml.gather({
      input: 'speech',
      action: `${config.baseUrl}/voice/ai-response`,
      method: 'POST',
      speechTimeout: 'auto',
      actionOnEmptyResult: true,
    });
    gather.say({ voice: 'Polly.Joanna' }, visibleText);

    // Fallback if no input
    twiml.redirect({ method: 'POST' }, `${config.baseUrl}/voice/ai-response`);
  }

  res.type('text/xml');
  res.send(twiml.toString());
});

/**
 * POST /voice/voicemail
 * Handles voicemail recording completion
 */
router.post('/voicemail', async (req, res) => {
  const twiml = new VoiceResponse();
  const callerNumber = req.body.From || 'Unknown';
  const recordingUrl = req.body.RecordingUrl;

  console.log(`📼 Voicemail from ${callerNumber}: ${recordingUrl}`);

  // Send basic SMS to contractor about voicemail
  try {
    const { notifyContractor } = require('./sms');
    await notifyContractor({
      callerName: 'Unknown (voicemail)',
      callerPhone: callerNumber,
      service: 'Left voicemail',
      timeline: 'Unknown',
      isEmergency: false,
      aiResponse: `Caller left a voicemail. Recording: ${recordingUrl}`,
    }, callerNumber);
  } catch (err) {
    console.error('Voicemail SMS error:', err.message);
  }

  twiml.say({ voice: 'Polly.Joanna' },
    'Thank you for your message. We will get back to you as soon as possible. Goodbye!');
  twiml.hangup();

  res.type('text/xml');
  res.send(twiml.toString());
});

/**
 * POST /voice/transcription
 * Receives voicemail transcription from Twilio
 */
router.post('/transcription', (req, res) => {
  console.log(`📝 Transcription: "${req.body.TranscriptionText}" from ${req.body.From}`);
  res.sendStatus(200);
});

module.exports = router;
