
/**
 * Audio engine for the additive synthesis of a singing bowl based on the
 * Web Audio API.
 * Special thanks to the master thesis of Johanna Stever:
 * https://uol.de/fileadmin/studg/hua/download/Masterarbeit_Johanna_Stever.pdf
 *
 * The sound is built from slightly detuned sine partials (which create the
 * characteristic slow beating of a bowl) plus a short, filtered noise
 * transient that models the contact of the mallet.
 */

// Container for all audio-related objects
const Audio = {
   "AudioContext": null,   // shared AudioContext
   "master":       null,   // master GainNode
   "limiter":      null,   // DynamicsCompressorNode used as a safety limiter
   "noiseBuffer":  null,   // buffer for the mallet strike transient
   "groupNodes":   [],     // group envelopes of the current strike
   "voices":       []      // currently running partials
};

// Tunable constants of the synthesis
const AUDIO = {
   attack:           0.014,  // s     - soft mallet contact, avoids a click
   lookahead:        0.020,  // s     - scheduling safety margin
   retriggerFade:    0.090,  // s     - damping of a previous strike
   decayTailFactor:  6,      // x     - multiples of the group decay time
   defaultDecay:     4,      // s     - fallback if data is missing
   minDecay:         0.3,    // s
   strikeLevel:      -30,    // dBFS  - level of the mallet noise
   strikeDecay:      0.07,   // s
   strikeTone:       2200,   // Hz
   strikeQ:          0.8,
   limiterThreshold: -3,     // dBFS
   limiterKnee:      6,      // dB
   limiterRatio:     8,
   limiterAttack:    0.003,  // s
   limiterRelease:   0.25    // s
};

/**
 * This function converts an amplitude in dBFS (decibels relative to full scale)
 * to a gain value in linear scale.
 * @param   ndB      amplitude in dBFS (decibels relative to full scale)
 * @returns float    gain value (linear scale) corresponding to the given amplitude in dBFS
 */
function audioDBToGain( ndB )
{
   return Math.pow( 10, (ndB)/20 );
}

/**
 * Converts a value from the UI (usually a string) into a finite number.
 * @param   value      value to convert
 * @param   fallback   value returned if the conversion fails
 * @returns number
 */
function audioNumber( value, fallback )
{
   const nNumber = parseFloat( value );
   return Number.isFinite( nNumber ) ? nNumber : fallback;
}

/**
 * Creates a short white-noise buffer used for the mallet transient.
 * @param   ctx   AudioContext
 * @returns AudioBuffer
 */
function audioCreateNoiseBuffer( ctx )
{
   const nLength = Math.floor( ctx.sampleRate * 0.3 );
   const buffer  = ctx.createBuffer( 1, nLength, ctx.sampleRate );
   const data    = buffer.getChannelData( 0 );
   for( let i = 0; i < nLength; i++ )
      data[i] = Math.random() * 2 - 1;
   return buffer;
}

/**
 * Initialises the audio context (once) and strikes the bowl.
 * @param   nVal   unused, kept for backwards compatibility
 */
function audioInit( nVal )
{
   if( null == Audio.AudioContext )
   {
      const Ctor = window.AudioContext || window.webkitAudioContext;
      if( !Ctor )
      {
         console.warn( "Web Audio API is not supported by this browser." );
         return;
      }

      Audio.AudioContext = new Ctor();

      // master gain
      Audio.master = Audio.AudioContext.createGain();
      Audio.master.gain.value = audioDBToGain( audioNumber( AppData.mastergain, -6 ) );

      // safety limiter: prevents clipping when many partials add up
      Audio.limiter = Audio.AudioContext.createDynamicsCompressor();
      Audio.limiter.threshold.value = AUDIO.limiterThreshold;
      Audio.limiter.knee.value      = AUDIO.limiterKnee;
      Audio.limiter.ratio.value     = AUDIO.limiterRatio;
      Audio.limiter.attack.value    = AUDIO.limiterAttack;
      Audio.limiter.release.value   = AUDIO.limiterRelease;

      Audio.master.connect( Audio.limiter );
      Audio.limiter.connect( Audio.AudioContext.destination );

      Audio.noiseBuffer = audioCreateNoiseBuffer( Audio.AudioContext );
   }

   // browsers start the context suspended until a user gesture happens
   if( "suspended" === Audio.AudioContext.state )
      Audio.AudioContext.resume();

   audioPlay();
}

/**
 * Fades out all voices of a previous strike and stops their oscillators.
 * @param   fade   fade-out time in seconds
 */
function audioDampVoices( fade )
{
   const ctx = Audio.AudioContext;
   if( null == ctx )
      return;

   const now       = ctx.currentTime;
   const oldGroups = Audio.groupNodes;
   const oldVoices = Audio.voices;

   // the new strike owns fresh arrays, old voices clean themselves up in onended
   Audio.groupNodes = [];
   Audio.voices     = [];

   // damp the group envelopes (this is what makes the sound disappear)
   oldGroups.forEach( ( Group ) =>
   {
      const param = Group.env.gain;
      if( "function" === typeof param.cancelAndHoldAtTime )
         param.cancelAndHoldAtTime( now );
      else
         param.cancelScheduledValues( now );

      param.setValueAtTime( Math.max( param.value, 0.0001 ), now );
      param.linearRampToValueAtTime( 0, now + fade );
   } );

   // stop the oscillators shortly after the fade
   oldVoices.forEach( ( Voice ) =>
   {
      try { Voice.osc.stop( now + fade + 0.05 ); } catch( e ) { /* already stopped */ }
   } );
}

/**
 * Creates one sine partial and connects it to the given group level node.
 * @param   ctx          AudioContext
 * @param   iGroup       group index in AppData
 * @param   iWave        partial index inside the group
 * @param   destination  node the partial is connected to
 * @param   startTime    absolute start time
 * @param   stopAt       absolute time when the oscillator is stopped
 * @param   fadeIn       fade-in time in seconds (0 for a normal strike)
 * @returns object|null  voice description
 */
function audioCreateVoice( ctx, iGroup, iWave, destination, startTime, stopAt, fadeIn )
{
   const Group = AppData.group[iGroup];
   if( !Group || !Group.waves[iWave] )
      return null;

   const Sine = Group.waves[iWave];
   const freq = audioNumber( Sine.f, 0 );
   if( !( freq > 0 ) )
      return null;

   const osc = ctx.createOscillator();
   osc.type = "sine";
   osc.frequency.value = freq;
   osc.frequency.setValueAtTime( freq, startTime );

   const gain  = ctx.createGain();
   const level = audioDBToGain( audioNumber( Sine.g, -90 ) );
   gain.gain.value = level;

   if( fadeIn > 0 )
   {
      gain.gain.setValueAtTime( 0, startTime );
      gain.gain.linearRampToValueAtTime( level, startTime + fadeIn );
   }
   else
   {
      gain.gain.setValueAtTime( level, startTime );
   }

   osc.connect( gain );
   gain.connect( destination );

   // Start each partial with a slightly different phase. This avoids an
   // artificial, overly percussive attack when all sines start in phase and
   // keeps the sum from producing a single large transient.
   const phase  = ( ( iGroup * 5 + iWave * 3 + 1 ) * 0.6180339887498949 ) % 1;
   const offset = phase / freq;

   osc.start( startTime + offset );
   try { osc.stop( stopAt + offset + 0.05 ); } catch( e ) { /* ignore */ }

   const Voice = { "osc": osc, "gain": gain, "groupIndex": iGroup, "waveIndex": iWave };
   osc.onended = () =>
   {
      const iIndex = Audio.voices.indexOf( Voice );
      if( iIndex >= 0 )
         Audio.voices.splice( iIndex, 1 );
   };

   Audio.voices.push( Voice );
   return Voice;
}

/**
 * Adds the short noise transient that models the mallet touching the bowl.
 * @param   when   absolute start time
 */
function audioPlayStrikeNoise( when )
{
   const ctx = Audio.AudioContext;
   if( null == ctx || null == Audio.noiseBuffer )
      return;

   const src    = ctx.createBufferSource();
   const filter = ctx.createBiquadFilter();
   const gain   = ctx.createGain();

   src.buffer = Audio.noiseBuffer;

   filter.type = "bandpass";
   filter.frequency.setValueAtTime( AUDIO.strikeTone, when );
   filter.Q.setValueAtTime( AUDIO.strikeQ, when );

   const peak = audioDBToGain( AUDIO.strikeLevel );
   gain.gain.setValueAtTime( 0.0001, when );
   gain.gain.linearRampToValueAtTime( peak, when + 0.004 );
   gain.gain.exponentialRampToValueAtTime( 0.0001, when + AUDIO.strikeDecay );

   src.connect( filter );
   filter.connect( gain );
   gain.connect( Audio.master );

   src.start( when );
   src.stop( when + AUDIO.strikeDecay + 0.05 );
}

/**
 * Builds the group envelopes and partial oscillators for one strike.
 * @param   startTime   absolute start time
 */
function audioBuildStrike( startTime )
{
   const ctx = Audio.AudioContext;
   let nVoices = 0;

   AppData.group.forEach( ( Group, iGroup ) =>
   {
      if( !Group.active )
         return;

      const bHasWave = Group.waves.some( ( Sine ) => true == Sine.a );
      if( !bHasWave )
         return;

      // level of the group (user setting, does not change during the decay)
      const level = ctx.createGain();
      const levelGain = audioDBToGain( audioNumber( Group.gain, -90 ) );
      level.gain.value = levelGain;
      level.gain.setValueAtTime( levelGain, startTime );

      // shared envelope of the group: soft attack + exponential decay
      const env = ctx.createGain();
      env.gain.value = 0;
      env.gain.setValueAtTime( 0, startTime );
      env.gain.linearRampToValueAtTime( 1, startTime + AUDIO.attack );

      const decay = Math.max( AUDIO.minDecay,
                              audioNumber( Group.time, AUDIO.defaultDecay ) );
      env.gain.setTargetAtTime( 0, startTime + AUDIO.attack, decay );

      level.connect( env );
      env.connect( Audio.master );

      const stopAt = startTime + AUDIO.attack + decay * AUDIO.decayTailFactor;
      Audio.groupNodes.push( {
         "index": iGroup,
         "level": level,
         "env":   env,
         "stopAt": stopAt,
         "decay": decay
      } );

      Group.waves.forEach( ( Sine, iWave ) =>
      {
         if( true != Sine.a )
            return;

         if( null != audioCreateVoice( ctx, iGroup, iWave, level, startTime, stopAt, 0 ) )
            nVoices++;
      } );
   } );

   if( nVoices > 0 )
      audioPlayStrikeNoise( startTime );
}

/**
 * Strikes the bowl: damps a still ringing strike and builds a new one.
 */
function audioPlay()
{
   const ctx = Audio.AudioContext;
   if( null == ctx )
      return;

   if( "suspended" === ctx.state )
      ctx.resume();

   audioDampVoices( AUDIO.retriggerFade );

   const startTime = ctx.currentTime + AUDIO.lookahead;
   audioBuildStrike( startTime );
}

/**
 * Applies the master gain from AppData, ramped to avoid a click.
 */
function audioApplyMaster()
{
   if( null == Audio.master || null == Audio.AudioContext )
      return;

   const now    = Audio.AudioContext.currentTime;
   const target = audioDBToGain( audioNumber( AppData.mastergain, -6 ) );
   Audio.master.gain.cancelScheduledValues( now );
   Audio.master.gain.setValueAtTime( Audio.master.gain.value, now );
   Audio.master.gain.setTargetAtTime( target, now, 0.02 );
}

/**
 * Applies a changed group gain to the current strike.
 * @param   iGroup   group index
 */
function audioApplyGroupGain( iGroup )
{
   if( null == Audio.AudioContext )
      return;

   const Group = AppData.group[iGroup];
   if( !Group )
      return;

   const now    = Audio.AudioContext.currentTime;
   const target = audioDBToGain( audioNumber( Group.gain, -90 ) );

   Audio.groupNodes.forEach( ( Node ) =>
   {
      if( Node.index == iGroup )
         Node.level.gain.setTargetAtTime( target, now, 0.03 );
   } );
}

/**
 * Applies a changed partial gain to the current strike.
 * @param   iGroup   group index
 * @param   iWave    partial index
 */
function audioApplyWaveGain( iGroup, iWave )
{
   if( null == Audio.AudioContext )
      return;

   const Group = AppData.group[iGroup];
   if( !Group || !Group.waves[iWave] )
      return;

   const now    = Audio.AudioContext.currentTime;
   const target = audioDBToGain( audioNumber( Group.waves[iWave].g, -90 ) );

   Audio.voices.forEach( ( Voice ) =>
   {
      if( Voice.groupIndex == iGroup && Voice.waveIndex == iWave )
         Voice.gain.gain.setTargetAtTime( target, now, 0.03 );
   } );
}

/**
 * Applies a changed partial frequency to the current strike.
 * @param   iGroup   group index
 * @param   iWave    partial index
 */
function audioApplyWaveFrequency( iGroup, iWave )
{
   if( null == Audio.AudioContext )
      return;

   const Group = AppData.group[iGroup];
   if( !Group || !Group.waves[iWave] )
      return;

   const freq = audioNumber( Group.waves[iWave].f, 0 );
   if( !( freq > 0 ) )
      return;

   const now = Audio.AudioContext.currentTime;
   Audio.voices.forEach( ( Voice ) =>
   {
      if( Voice.groupIndex == iGroup && Voice.waveIndex == iWave )
         Voice.osc.frequency.setTargetAtTime( freq, now, 0.03 );
   } );
}

/**
 * Starts or stops a single partial while the bowl is ringing.
 * @param   iGroup   group index
 * @param   iWave    partial index
 * @param   bActive  desired state
 */
function audioSetVoiceActive( iGroup, iWave, bActive )
{
   if( null == Audio.AudioContext )
      return;

   const ctx = Audio.AudioContext;
   const now = ctx.currentTime;

   if( !bActive )
   {
      Audio.voices.slice().forEach( ( Voice ) =>
      {
         if( Voice.groupIndex != iGroup || Voice.waveIndex != iWave )
            return;

         const param = Voice.gain.gain;
         if( "function" === typeof param.cancelAndHoldAtTime )
            param.cancelAndHoldAtTime( now );
         else
            param.cancelScheduledValues( now );

         param.setValueAtTime( Math.max( param.value, 0.0001 ), now );
         param.linearRampToValueAtTime( 0, now + 0.12 );
         try { Voice.osc.stop( now + 0.15 ); } catch( e ) { /* ignore */ }
      } );
      return;
   }

   // join the current strike if it is still ringing
   const Node = Audio.groupNodes.find( ( Item ) => Item.index == iGroup );
   if( Node && now < Node.stopAt )
   {
      audioCreateVoice( ctx, iGroup, iWave, Node.level, now + 0.005,
                        Node.stopAt, AUDIO.attack );
   }
}
