
/**
 * This function displays the groups of tones in the user interface.
 * It creates a card for every group with switches, frequency fields,
 * gain sliders and a decay-time control.
 */
let appResizeBound = false;

/* ---------- persistent settings ---------- */

const APP_STORAGE_KEY = "singing-bowl-settings-v1";
let appDataLoaded = false;

/**
 * Writes the current AppData to localStorage.
 */
function appSaveData()
{
   try
   {
      localStorage.setItem( APP_STORAGE_KEY, JSON.stringify( AppData ) );
   }
   catch( Error )
   {
      console.warn( "Could not save settings:", Error );
   }
}

/**
 * Merges saved settings into AppData. Only valid fields are applied, so
 * incomplete or corrupted storage falls back to the defaults from data.js.
 */
function appLoadData()
{
   let Stored = null;

   try
   {
      Stored = JSON.parse( localStorage.getItem( APP_STORAGE_KEY ) );
   }
   catch( Error )
   {
      Stored = null;
   }

   if( !Stored || "object" !== typeof Stored )
      return;

   const nMaster = audioNumber( Stored.mastergain, NaN );
   if( Number.isFinite( nMaster ) )
      AppData.mastergain = nMaster;

   if( !Array.isArray( Stored.group ) )
      return;

   const nGroups = Math.min( AppData.group.length, Stored.group.length );
   for( let iGroup=0; iGroup < nGroups; iGroup++ )
   {
      const Source = Stored.group[iGroup];
      const Target = AppData.group[iGroup];
      if( !Source || "object" !== typeof Source )
         continue;

      const nGain = audioNumber( Source.gain, NaN );
      if( Number.isFinite( nGain ) )
         Target.gain = nGain;

      const nTime = audioNumber( Source.time, NaN );
      if( nTime > 0 )
         Target.time = nTime;

      if( "boolean" === typeof Source.active )
         Target.active = Source.active;

      if( !Array.isArray( Source.waves ) )
         continue;

      const nWaves = Math.min( Target.waves.length, Source.waves.length );
      for( let iWave=0; iWave < nWaves; iWave++ )
      {
         const WaveIn  = Source.waves[iWave];
         const WaveOut = Target.waves[iWave];
         if( !WaveIn || "object" !== typeof WaveIn )
            continue;

         const f = audioNumber( WaveIn.f, NaN );
         if( f > 0 )
            WaveOut.f = f;

         const g = audioNumber( WaveIn.g, NaN );
         if( Number.isFinite( g ) )
            WaveOut.g = g;

         if( "boolean" === typeof WaveIn.a )
            WaveOut.a = WaveIn.a;
      }
   }
}

function appUpdateView()
{
   if( !appDataLoaded )
   {
      appDataLoaded = true;
      appLoadData();
      appSaveData();
   }

   const groups = document.getElementById( "groups" );
   groups.innerHTML = "";

   for( let iGroup=0; iGroup < AppData.group.length; iGroup++ )
   {
      const Data = AppData.group[iGroup];
      let sPartials = "";

      for( let iWave=0; iWave < Data.waves.length; iWave++ )
      {
         const Sine  = Data.waves[iWave];
         const nGain = Math.max( -60, Math.min( 0, audioNumber( Sine.g, -60 ) ) );

         sPartials += `
            <div class="partial ${Sine.a ? "" : "is-off"}">
               <label class="switch" title="Activate partial ${iWave + 1}">
                  <input type="checkbox" ${Sine.a ? "checked" : ""}
                         aria-label="Activate partial ${iWave + 1}"
                         onchange="audioToggle( ${iGroup}, ${iWave}, this.checked ); appTogglePartial( this );" />
                  <span class="switch-track"><span class="switch-thumb"></span></span>
               </label>
               <div class="field freq-field">
                  <span class="field-label">Frequency</span>
                  <div class="unit-input">
                     <input type="number" step="any" min="1" value="${Sine.f}"
                            aria-label="Partial ${iWave + 1} frequency in hertz"
                            onchange="audioSetFreq( ${iGroup}, ${iWave}, this.value )" />
                     <span class="unit">Hz</span>
                  </div>
               </div>
               <div class="field gain-field">
                  <span class="field-label">Gain</span>
                  <div class="slider-unit">
                     <input type="range" min="-60" max="0" step="0.5" value="${nGain}"
                            aria-label="Partial ${iWave + 1} gain in decibels"
                            oninput="appSetPartialGain( ${iGroup}, ${iWave}, this.value, this )" />
                     <div class="unit-input compact">
                        <input type="number" step="any" value="${Sine.g}"
                               aria-label="Partial ${iWave + 1} gain in decibels"
                               onchange="appSetPartialGain( ${iGroup}, ${iWave}, this.value, this )" />
                        <span class="unit">dB</span>
                     </div>
                  </div>
               </div>
            </div>`;
      }

      const freqs  = Data.waves.map( ( Sine ) => audioNumber( Sine.f, 0 ) ).filter( ( f ) => f > 0 );
      const minF   = 0 < freqs.length ? Math.min( ...freqs ) : 0;
      const maxF   = 0 < freqs.length ? Math.max( ...freqs ) : 0;
      const spread = maxF - minF;
      const rangeLabel = 0 < freqs.length
         ? ( 0.05 <= spread ? minF.toFixed( 1 ) + "–" + maxF.toFixed( 1 ) + " Hz"
                            : minF.toFixed( 1 ) + " Hz" )
         : "—";

      const nGroupGain = Math.max( -60, Math.min( 0, audioNumber( Data.gain, -60 ) ) );
      const nTime      = Math.max( 0.5, Math.min( 12, audioNumber( Data.time, 4 ) ) );

      const card = document.createElement( "article" );
      card.className = "group-card";
      card.innerHTML = `
         <header class="group-head">
            <div class="group-title">
               <span class="group-index">${String( iGroup + 1 ).padStart( 2, "0" )}</span>
               <h3>Partial group</h3>
            </div>
            <span class="badge">${rangeLabel}</span>
         </header>

         <div class="partials">${sPartials}</div>

         <div class="group-meta">
            <div class="field">
               <span class="field-label">Group gain</span>
               <div class="slider-unit">
                  <input type="range" min="-60" max="0" step="0.5" value="${nGroupGain}"
                         aria-label="Group ${iGroup + 1} gain in decibels"
                         oninput="appSetGroupGain( ${iGroup}, this.value, this )" />
                  <div class="unit-input compact">
                     <input type="number" step="any" value="${Data.gain}"
                            aria-label="Group ${iGroup + 1} gain in decibels"
                            onchange="appSetGroupGain( ${iGroup}, this.value, this )" />
                     <span class="unit">dB</span>
                  </div>
               </div>
            </div>
            <div class="field">
               <span class="field-label">Decay time</span>
               <div class="slider-unit">
                  <input type="range" min="0.5" max="12" step="0.5" value="${nTime}"
                         aria-label="Group ${iGroup + 1} decay time in seconds"
                         oninput="appSetGroupTime( ${iGroup}, this.value, this )" />
                  <div class="unit-input compact">
                     <input type="number" step="any" min="0.1" value="${Data.time}"
                            aria-label="Group ${iGroup + 1} decay time in seconds"
                            onchange="appSetGroupTime( ${iGroup}, this.value, this )" />
                     <span class="unit">s</span>
                  </div>
               </div>
            </div>
         </div>`;
      groups.appendChild( card );
   }

   // master volume
   const nMaster = audioNumber( AppData.mastergain, -6 );
   const range   = document.getElementById( "masterRange" );
   const number  = document.getElementById( "master" );
   if( range )
      range.value = Math.max( -40, Math.min( 0, nMaster ) );
   if( number )
      number.value = nMaster;

   document.querySelectorAll( 'input[type="range"]' ).forEach( appRangeFill );

   if( !appResizeBound )
   {
      appResizeBound = true;
      window.addEventListener( "resize", () =>
      {
         document.querySelectorAll( 'input[type="range"]' ).forEach( appRangeFill );
      } );
   }
}

/**
 * Fills a range input up to its current value and keeps the sibling
 * number field in sync.
 * @param   Range   range input
 * @param   value   new value
 */
function appSyncSlider( range, value )
{
   const Wrap = range && range.closest ? range.closest( ".slider-unit" ) : null;
   if( !Wrap )
      return;

   Wrap.querySelectorAll( "input" ).forEach( ( El ) =>
   {
      if( El !== range )
         El.value = value;
   } );

   const Range = Wrap.querySelector( 'input[type="range"]' );
   if( Range )
      appRangeFill( Range );
}

/**
 * Colours the filled part of a range input.
 * The thumb only travels between its own radii, so the fill has to stop
 * at the centre of the thumb instead of at a plain percentage.
 * @param   Range   range input
 */
function appRangeFill( Range )
{
   if( !Range || "range" !== Range.type )
      return;

   const nMinRaw = parseFloat( Range.min );
   const nMaxRaw = parseFloat( Range.max );
   const nMin    = Number.isFinite( nMinRaw ) ? nMinRaw : 0;
   const nMax    = Number.isFinite( nMaxRaw ) ? nMaxRaw : 100;
   const nVal    = parseFloat( Range.value );
   const f       = nMax > nMin ? ( nVal - nMin ) / ( nMax - nMin ) : 0;
   const nWidth  = Range.clientWidth;
   const nThumb  = parseFloat( getComputedStyle( Range ).getPropertyValue( "--thumb-size" ) ) || 18;

   let nPct = f * 100;
   if( nWidth > nThumb )
      nPct = ( ( nThumb / 2 + f * ( nWidth - nThumb ) ) / nWidth ) * 100;

   Range.style.setProperty( "--fill", Math.max( 0, Math.min( 100, nPct ) ) + "%" );
}

/**
 * Sets the master volume from a slider or number field.
 * @param   value   value in dBFS
 * @param   Input   triggering input
 */
function appSetMaster( value, Input )
{
   const nGain = parseFloat( value );
   if( !Number.isFinite( nGain ) )
      return;

   audioSetGain( -1, -1, nGain );
   appSyncSlider( Input, nGain );
}

/**
 * Sets the gain of a group.
 * @param   iGroup   group index
 * @param   value    value in dBFS
 * @param   Input    triggering input
 */
function appSetGroupGain( iGroup, value, Input )
{
   const nGain = parseFloat( value );
   if( !Number.isFinite( nGain ) )
      return;

   audioSetGain( iGroup, -1, nGain );
   appSyncSlider( Input, nGain );
}

/**
 * Sets the decay time of a group.
 * @param   iGroup   group index
 * @param   value    value in seconds
 * @param   Input    triggering input
 */
function appSetGroupTime( iGroup, value, Input )
{
   const nTime = parseFloat( value );
   if( !Number.isFinite( nTime ) )
      return;

   audioSetTime( iGroup, nTime );
   appSyncSlider( Input, nTime );
}

/**
 * Sets the gain of a single partial.
 * @param   iGroup   group index
 * @param   iWave    partial index
 * @param   value    value in dBFS
 * @param   Input    triggering input
 */
function appSetPartialGain( iGroup, iWave, value, Input )
{
   const nGain = parseFloat( value );
   if( !Number.isFinite( nGain ) )
      return;

   audioSetGain( iGroup, iWave, nGain );
   appSyncSlider( Input, nGain );
}

/**
 * Visually dims a partial row when its switch is turned off.
 * @param   Checkbox   changed checkbox
 */
function appTogglePartial( Checkbox )
{
   const Row = Checkbox.closest( ".partial" );
   if( Row )
      Row.classList.toggle( "is-off", !Checkbox.checked );
}

/**
 * Strikes the bowl and plays the sonar animation on the button.
 */
let appStrikeTimer = null;
function appStrike()
{
   audioInit();

   const Button = document.getElementById( "strike" );
   if( !Button )
      return;

   Button.classList.remove( "is-striking" );
   void Button.offsetWidth;
   Button.classList.add( "is-striking" );

   if( appStrikeTimer )
      window.clearTimeout( appStrikeTimer );
   appStrikeTimer = window.setTimeout( () =>
   {
      Button.classList.remove( "is-striking" );
   }, 1400 );
}

/**
 * Activates or deactivates a single partial.
 * @param   iGroup   group index
 * @param   iWave    partial index
 * @param   bCheck   new state from the checkbox
 */
function audioToggle( iGroup, iWave, bCheck )
{
   const Group = AppData.group[iGroup];
   if( !Group || !Group.waves[iWave] )
      return;

   Group.waves[iWave].a = !!bCheck;
   audioSetVoiceActive( iGroup, iWave, Group.waves[iWave].a );
   appSaveData();
}

/**
 * Updates the frequency of a partial and applies it to the running sound.
 * @param   iGroup   group index
 * @param   iWave    partial index
 * @param   nFreq    new frequency in Hz
 */
function audioSetFreq( iGroup, iWave, nFreq )
{
   const Group = AppData.group[iGroup];
   if( !Group || !Group.waves[iWave] )
      return;

   const freq = audioNumber( nFreq, 0 );
   if( !( freq > 0 ) )
      return;

   Group.waves[iWave].f = freq;
   audioApplyWaveFrequency( iGroup, iWave );
   appSaveData();
}

/**
 * Updates a gain value. iGroup == -1 addresses the master gain,
 * iWave == -1 addresses the group gain.
 * @param   iGroup   group index or -1 for master
 * @param   iWave    partial index or -1 for group gain
 * @param   nGain    new gain in dBFS
 */
function audioSetGain( iGroup, iWave, nGain )
{
   const gain = audioNumber( nGain, NaN );
   if( !Number.isFinite( gain ) )
      return;

   if( -1 == iGroup )
   {
      AppData.mastergain = gain;
      audioApplyMaster();
      appSaveData();
      return;
   }

   const Group = AppData.group[iGroup];
   if( !Group )
      return;

   if( -1 == iWave )
   {
      Group.gain = gain;
      audioApplyGroupGain( iGroup );
      appSaveData();
      return;
   }

   if( !Group.waves[iWave] )
      return;

   Group.waves[iWave].g = gain;
   audioApplyWaveGain( iGroup, iWave );
   appSaveData();
}

/**
 * Updates the decay time of a group (used for the next strike).
 * @param   iGroup   group index
 * @param   nTime    new decay time in seconds
 */
function audioSetTime( iGroup, nTime )
{
   const Group = AppData.group[iGroup];
   if( !Group )
      return;

   const time = audioNumber( nTime, 0 );
   if( time > 0 )
   {
      Group.time = time;
      appSaveData();
   }
}

/**
 * Opens or closes the settings panel.
 * @param   El   toggle button
 */
function collapse( El )
{
   const content = El.nextElementSibling;
   const bOpen    = !El.classList.contains( "open" );

   El.classList.toggle( "open", bOpen );
   El.setAttribute( "aria-expanded", bOpen ? "true" : "false" );

   if( content )
      content.classList.toggle( "open", bOpen );

   if( bOpen )
   {
      window.setTimeout( () =>
      {
         document.querySelectorAll( 'input[type="range"]' ).forEach( appRangeFill );
      }, 520 );
   }
}

/* ---------- installable app ---------- */

let appInstallPrompt = null;

/**
 * Shows the install button once it is available in the document.
 * @param   bShow   whether the button should be visible
 */
function appShowInstallButton( bShow )
{
   const Apply = () =>
   {
      const Button = document.getElementById( "installBtn" );
      if( Button )
         Button.hidden = !bShow;
   };

   if( "loading" === document.readyState )
      document.addEventListener( "DOMContentLoaded", Apply, { once: true } );
   else
      Apply();
}

window.addEventListener( "beforeinstallprompt", ( Event ) =>
{
   Event.preventDefault();
   appInstallPrompt = Event;
   appShowInstallButton( true );
} );

window.addEventListener( "appinstalled", () =>
{
   appInstallPrompt = null;
   appShowInstallButton( false );
} );

/**
 * Shows the browser's install prompt for the app.
 */
function appInstall()
{
   if( !appInstallPrompt )
      return;

   const Prompt = appInstallPrompt;
   appInstallPrompt = null;

   Prompt.prompt();
   Prompt.userChoice.then( ( Choice ) =>
   {
      const Button = document.getElementById( "installBtn" );
      if( Button && "accepted" === Choice.outcome )
         Button.hidden = true;
   } );
}

if( "serviceWorker" in navigator )
{
   window.addEventListener( "load", () =>
   {
      navigator.serviceWorker.register( "sw.js" ).catch( ( Error ) =>
      {
         console.warn( "Service worker registration failed:", Error );
      } );
   } );
}

/* ---------- documentation ---------- */

/**
 * Opens the documentation dialog.
 */
function appOpenDocs()
{
   const Dialog = document.getElementById( "docsDialog" );
   if( !Dialog )
      return;

   if( "function" === typeof Dialog.showModal )
      Dialog.showModal();
   else
      Dialog.setAttribute( "open", "" );
}

/**
 * Closes the documentation dialog.
 */
function appCloseDocs()
{
   const Dialog = document.getElementById( "docsDialog" );
   if( !Dialog )
      return;

   if( "function" === typeof Dialog.close )
      Dialog.close();
   else
      Dialog.removeAttribute( "open" );
}

/**
 * Lets a click on the dimmed backdrop close the documentation.
 */
function appBindDocs()
{
   const Dialog = document.getElementById( "docsDialog" );
   if( !Dialog )
      return;

   Dialog.addEventListener( "click", ( Event ) =>
   {
      if( Event.target === Dialog )
         appCloseDocs();
   } );
}

if( "loading" === document.readyState )
   document.addEventListener( "DOMContentLoaded", appBindDocs, { once: true } );
else
   appBindDocs();

