
/**
 * This function displays the groups of tones in the user interface. 
 * It iterates through the groups and tones, creating HTML elements 
 * for each tone's frequency, gain, and active status.
 * The function also sets up event handlers for toggling the active 
 * status and changing the frequency and gain values.
 */
function appUpdateView()
{
   //
   // draw groups
   const groups = document.getElementById( "groups" );
   for( let iWave=0; iWave < AppData.group.length; iWave++ )
   {
      const Data = AppData.group[iWave];
      sInnerHtml = "";
      for( let iSine=0; iSine < Data.waves.length; iSine++ )
      {
         const Sine = Data.waves[iSine];
         let sCheck = "checked";
         if( false == Sine.a  ) { sCheck = ""; }   
         sInnerHtml += `
            <tr>
               <td><input class="w3-check" type="checkbox" ${sCheck} onchange="audioToggle( ${iWave}, ${iSine}, this.checked );"></td>   
               <td><input class="freq w3-input w3-border w3-border-black w3-round-large" type="number" value="${Sine.f}" onchange="audioSetFreq( ${iWave}, ${iSine}, this.value );"></td>
               <td><input class="gain w3-input w3-border w3-border-black w3-round-large" type="number" value="${Sine.g}" onchange="audioSetGain( ${iWave}, ${iSine}, this.value );"></td>
            </tr>\n`;
      }
      const group = document.createElement( "div" );
      group.className = "w3-card-4 w3-round-large w3-border-black tran";
      sInnerHtml  = '<table class="w3-table"><tr> <th>Active</th> <th>Frequency</th> <th>Gain</th> </tr>'+sInnerHtml+'</table>';
      sInnerHtml += '<hr>';
      sInnerHtml += '<table class="w3-table"><tr> <th></th> <th></th> <th></th> </tr>';
      sInnerHtml += '<tr><td>Group Gain</td> <td><input class="gain w3-input w3-border w3-border-black w3-round-large" type="number" value="'+Data.gain+'" onchange="audioSetGain( '+iWave+', -1, this.value );"></td> <td>dB</td></tr>';
      sInnerHtml += '<tr><td>Time</td> <td><input class="time w3-input w3-border w3-border-black w3-round-large" type="number" value="'+Data.time+'" onchange="audioSetTime( '+iWave+', this.value );"></td> <td>s</td></tr>';
      sInnerHtml += '</table>';
      group.innerHTML = sInnerHtml;
      groups.appendChild( group );
   }
   document.getElementById( "master" ).value = AppData.mastergain;
}

function audioToggle( iWave, iSine, bCheck )
{
   AppData[iWave].waves[iSine].a = bCheck;
}

function audioSetFreq( iWave, iSine, nFreq )
{  
   AppData[iWave].waves[iSine].f = nFreq;
} 

function audioSetGain( iWave, iSine, nGain )
{  
   if( -1 == iWave )
   {
      AppData.mastergain = nGain;
   }
   else if( -1 == iSine )
   {
      AppData[iWave].gain = nGain;
   }
   else
   {
      AppData[iWave].waves[iSine].g = nGain;
   }
} 

function audioSetTime( iWave, nTime )
{  
   AppData[iWave].time = nTime;
}

function collapse( El )
{
   El.classList.toggle("active");
   let content = El.nextElementSibling;
   if( content.style.display === "none" ) 
      content.style.display = "";
   else
      content.style.display = "none";
}
