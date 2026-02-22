
/**
 * Audio-Engine for additive synthesis of a "Klangschale" based on the Web Audio API.
 * Special thanks to the master thesis of Johanna Stever 
 * https://uol.de/fileadmin/studg/hua/download/Masterarbeit_Johanna_Stever.pdf
 */

// Container for all audio-related objects
const Audio = { "AudioContext":null, "master":null, "sine":[], "gain":[] };

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


function audioInit( nVal )
{
   if( null != Audio.AudioContext )
   {
      Audio.AudioContext.close();
      Audio.AudioContext = null;
   }
   Audio.AudioContext = new (window.AudioContext || window.webkitAudioContext)();
   audioPlay();
}


function audioPlay()
{
   Audio.sine = [];
   Audio.gain = [];
   Audio.master = null;

   // create master gain node
   let masterGain = Audio.AudioContext.createGain();
   masterGain.gain.value = 0.0;
   masterGain.connect( Audio.AudioContext.destination );
   Audio.master = masterGain;

   // create oscillators and gain nodes for each partial
   AppData.group.forEach( Group => 
   {
      if( Group.active )
      {
         let groupGainNode = Audio.AudioContext.createGain();
         let nGain = audioDBToGain( Group.gain );
         groupGainNode.gain.value = nGain;
         Audio.gain.push( { "node":groupGainNode, "time":Group.time, "gain":nGain } );
         groupGainNode.connect( masterGain );
         //
         Group.waves.forEach( ( Sine ) =>
         {
            if( true == Sine.a )
            {
               let osc = Audio.AudioContext.createOscillator();
               osc.type = "sine";
               osc.frequency.value = Sine.f;
               // osc.start();
               let gainNode = Audio.AudioContext.createGain();
               gainNode.gain.value = audioDBToGain( Sine.g );
               //
               Audio.sine.push( { "node":osc, "gain":gainNode } );
               //
               osc.connect( gainNode );
               gainNode.connect( groupGainNode );
               osc.start();
            }
         } );
      }  //if( Group.active )
      audioStopAll();
      setTimeout( audioStart, 100 );
   } );
}

function audioStopAll() 
{
   Audio.gain.forEach( ( { node, time, gain } ) => 
   {
      node.gain.value = 0.0;
   } );
   Audio.master.gain.value = 0.0;
}

function audioStart()
{
   Audio.gain.forEach( ( { node, time, gain } ) => 
   {
      node.gain.value = gain;
      node.gain.setTargetAtTime( 0, Audio.AudioContext.currentTime, time );
   } );
   Audio.master.gain.value = audioDBToGain( AppData.mastergain );
}
