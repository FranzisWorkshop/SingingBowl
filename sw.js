/**
 * Service worker for the Singing Bowl web app.
 * Keeps the app shell available offline and serves fresh content when online.
 */

const CACHE_NAME = "singing-bowl-v1";

const APP_SHELL = [
   "./",
   "./index.html",
   "./style.css",
   "./app.js",
   "./audio.js",
   "./data.js",
   "./background.jpg",
   "./background2.jpg",
   "./manifest.json",
   "./icons/icon-180.png",
   "./icons/icon-192.png",
   "./icons/icon-512.png",
   "./icons/maskable-512.png"
];

self.addEventListener( "install", ( Event ) =>
{
   Event.waitUntil(
      caches.open( CACHE_NAME )
         .then( ( Cache ) => Cache.addAll( APP_SHELL ) )
         .then( () => self.skipWaiting() )
   );
} );

self.addEventListener( "activate", ( Event ) =>
{
   Event.waitUntil(
      caches.keys()
         .then( ( Keys ) => Promise.all(
            Keys
               .filter( ( Key ) => Key.startsWith( "singing-bowl-" ) && Key !== CACHE_NAME )
               .map( ( Key ) => caches.delete( Key ) )
         ) )
         .then( () => self.clients.claim() )
   );
} );

self.addEventListener( "fetch", ( Event ) =>
{
   const Request = Event.request;

   if( "GET" !== Request.method )
      return;

   const Url = new URL( Request.url );
   if( Url.origin !== self.location.origin )
      return;

   Event.respondWith( ( async () =>
   {
      const Cache = await caches.open( CACHE_NAME );

      try
      {
         const Response = await fetch( Request );

         if( Response && 200 === Response.status )
         {
            Cache.put( Request, Response.clone() ).catch( () => {} );
            return Response;
         }

         // Server errors: prefer the cached copy so the app stays usable.
         if( Response && 500 <= Response.status )
         {
            const Cached = await Cache.match( Request, { ignoreSearch: true } );
            if( Cached )
               return Cached;

            if( "navigate" === Request.mode )
            {
               const Shell = ( await Cache.match( "./index.html" ) ) || ( await Cache.match( "./" ) );
               if( Shell )
                  return Shell;
            }
         }

         return Response;
      }
      catch( Error )
      {
         const Cached = await Cache.match( Request, { ignoreSearch: true } );
         if( Cached )
            return Cached;

         if( "navigate" === Request.mode )
         {
            const Shell = ( await Cache.match( "./index.html" ) ) || ( await Cache.match( "./" ) );
            if( Shell )
               return Shell;
         }

         return new Response( "Offline", {
            status: 503,
            headers: { "Content-Type": "text/plain; charset=utf-8" }
         } );
      }
   } )() );
} );
