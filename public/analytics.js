/* Deep Focus site analytics: PostHog, cookieless.
   persistence "memory" = no cookies or localStorage, so no consent banner.
   No autocapture, no session recordings. Events: $pageview, cta_click, email_signup. */
!function(t,e){var o,n,p,r;e.__SV||(window.posthog=e,e._i=[],e.init=function(i,s,a){function g(t,e){var o=e.split(".");2==o.length&&(t=t[o[0]],e=o[1]),t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}}(p=t.createElement("script")).type="text/javascript",p.crossOrigin="anonymous",p.async=!0,p.src=s.api_host.replace(".i.posthog.com","-assets.i.posthog.com")+"/static/array.js",(r=t.getElementsByTagName("script")[0]).parentNode.insertBefore(p,r);var u=e;for(void 0!==a?u=e[a]=[]:a="posthog",u.people=u.people||[],u.toString=function(t){var e="posthog";return"posthog"!==a&&(e+="."+a),t||(e+=" (stub)"),e},u.people.toString=function(){return u.toString(1)+".people (stub)"},o="init capture register register_once unregister opt_out_capturing has_opted_out_capturing opt_in_capturing reset identify get_distinct_id".split(" "),n=0;n<o.length;n++)g(u,o[n]);e._i.push([i,s,a])},e.__SV=1)}(document,window.posthog||[]);
posthog.init('phc_rS7Rfw6yzmgv6YkxdwU6PV7F3CBGFGxcLD8oen2vGpdB', {
  api_host: 'https://us.i.posthog.com',
  persistence: 'memory',
  autocapture: false,
  capture_pageview: true,
  capture_pageleave: false,
  disable_session_recording: true,
  disable_surveys: true,
  respect_dnt: true
});
