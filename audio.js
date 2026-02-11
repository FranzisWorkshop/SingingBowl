
/**
 * Audio-Engine for additive synthesis of a "Klangschale" based on the Web Audio API.
 * Special thanks to the master thesis of Johanna Stever 
 * https://uol.de/fileadmin/studg/hua/download/Masterarbeit_Johanna_Stever.pdf
 */

// Container for all audio-related objects
const Audio = { "AudioContext":null, "oscillators":[], "gaingroup":[] };

/**
 * This function converts an amplitude in dBFS (decibels relative to full scale) 
 * to a gain value in linear scale.
 * @param   ndB      - amplitude in dBFS (decibels relative to full scale)
 * @returns float    - gain value (linear scale) corresponding to the given amplitude in dBFS
 */
function audioDBToGain( ndB )
{
   return Math.pow( 10, (ndB+30)/20 );
}

function audioInit( nFreqFactor = 1.0 )
{
   // AudioContext
   Audio.AudioContext = new (window.AudioContext || window.webkitAudioContext)();

   // frequency | amplitude (dBFS) | gain group
   const partials =  
   [
//ori     [82.936,  -53.723, 0],
//ori     [85.292,  -52.813, 0],
      [82.936,  -45.723, 0],
      [85.292,  -44.813, 0],
      [152.751, -75.294, 0],
      //
      [170.415, -81.596, 1],
      [241.239, -56.288, 1],
      [243.594, -72.382, 1],
//ori     [439.244, -95.040, 2],
      [443.954, -83.569, 2],
      [460.272, -72.940, 2],
      [465.319, -68.369, 2],
      [482.647, -59.048, 2],
      [487.357, -63.363, 2],
//ori     [487.357, -57.363, 2],
      //
      [733.811, -79.347, 3],
      [738.185, -68.495, 3],
      [846.188, -89.915, 3],
      //
      [1055.632, -87.148, 4],
      [1057.146, -85.545, 4],
// ori   [1413.789, -76.629, 5],
// ori   [1820.229, -94.416, 5]
   ];

   // create master gain node
   const masterGain = Audio.AudioContext.createGain();
   masterGain.gain.value = 0.8;
   masterGain.connect( Audio.AudioContext.destination );

   // create gain nodes for each group
   Audio.groupGains = [];
   partials.forEach( aTone =>
   {
      const [ nFrequency, nAmplitudeDb, nGroup ] = aTone;
      if( ! Audio.groupGains[ nGroup ] )
      {
         const gainNode = Audio.AudioContext.createGain();
         gainNode.gain.value = 1.0;
         gainNode.connect( masterGain );
         Audio.groupGains.push( gainNode );
      } 
   } );

   // create oscillators and gain nodes for each partial
   partials.forEach( aTone => 
   {
      const [ nFrequency, nAmplitudeDb, nGroup ] = aTone;
      //
      const osc = Audio.AudioContext.createOscillator();
      osc.type = "sine";
      osc.frequency.value = nFrequency * nFreqFactor;
      //
      const gainNode = Audio.AudioContext.createGain();
      gainNode.gain.value = audioDBToGain( nAmplitudeDb );
      //
      osc.connect( gainNode );
      gainNode.connect( Audio.groupGains[ nGroup ] );
      Audio.oscillators.push( { osc, gainNode } );
   } );

   //
   audioStartAll();
}

function audioStopAll() 
{
   Audio.oscillators.forEach( ( { osc } ) => osc.stop() );
}

function audioStartAll() 
{
   Audio.oscillators.forEach( ( { osc } ) => osc.start() );
   let n = 8;
   Audio.groupGains.forEach( ( gainNode ) => 
   {
      const now = Audio.AudioContext.currentTime;
      gainNode.gain.setValueAtTime( 1.0, now ); 
      gainNode.gain.exponentialRampToValueAtTime( 0.0001, now + 5*n );
      n -= 1;
   } );
}

