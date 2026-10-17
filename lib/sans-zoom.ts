/**
 * L'app ne se zoome pas : elle se tient comme une app, pas comme une page.
 * Le viewport dit déjà « pas de zoom », mais Safari sur iPhone l'ignore pour
 * le pincement ; ce script, posé dans <head> avant React, bloque le geste à
 * deux doigts (gesturestart côté Safari, touchmove à plusieurs doigts
 * ailleurs). Le double toucher est déjà coupé par touch-action: manipulation.
 * Pour lire plus grand, il y a le réglage « Gros texte ».
 */
export const SANS_ZOOM = `(function(){try{var n=function(e){e.preventDefault()};document.addEventListener("gesturestart",n,{passive:false});document.addEventListener("gesturechange",n,{passive:false});document.addEventListener("touchmove",function(e){if(e.touches&&e.touches.length>1)e.preventDefault()},{passive:false})}catch(e){}})();`;
