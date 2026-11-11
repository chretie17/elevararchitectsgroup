// Opening screen: the white Elevar logo is revealed on charcoal, a bronze line
// draws underneath, the tagline fades in, then the screen slides up.
// Shown once per visit (sessionStorage). Never blocks for more than ~4s, and
// hides itself with CSS alone if JavaScript doesn't run.

const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const LOGO = "/wp-content/uploads/2025/12/elevar_1-06l-1290x500.png";

const CSS = `
#elevar-intro{position:fixed;inset:0;z-index:2147483000;background:#141414;display:flex;align-items:center;justify-content:center;animation:ei-auto .6s ease 4.6s forwards}
#elevar-intro .ei-box{display:flex;flex-direction:column;align-items:center;gap:14px;transition:opacity .4s ease,transform .6s ease}
#elevar-intro img{width:min(360px,64vw);height:auto;clip-path:inset(0 100% 0 0);animation:ei-reveal 1.15s cubic-bezier(.77,0,.18,1) .15s forwards}
#elevar-intro .ei-line{width:min(280px,50vw);height:1px;background:rgba(255,255,255,.14);position:relative;overflow:hidden}
#elevar-intro .ei-line:after{content:"";position:absolute;inset:0;background:#b8864b;transform:scaleX(0);transform-origin:left;animation:ei-line 1.3s cubic-bezier(.65,0,.35,1) .45s forwards}
#elevar-intro .ei-tag{font:500 11px/1.4 Inter,"Helvetica Neue",Arial,sans-serif;letter-spacing:.42em;text-indent:.42em;text-transform:uppercase;color:rgba(255,255,255,.72);text-align:center;padding:0 16px;opacity:0;transform:translateY(8px);animation:ei-up .8s ease 1s forwards}
#elevar-intro.ei-out{transform:translateY(-100%);transition:transform .95s cubic-bezier(.77,0,.18,1)}
#elevar-intro.ei-out .ei-box{opacity:0;transform:translateY(-24px)}
html.ei-seen #elevar-intro{display:none}
@keyframes ei-reveal{to{clip-path:inset(0 0 0 0)}}
@keyframes ei-line{to{transform:scaleX(1)}}
@keyframes ei-up{to{opacity:1;transform:none}}
@keyframes ei-auto{to{opacity:0;visibility:hidden}}
@media (prefers-reduced-motion:reduce){#elevar-intro *,#elevar-intro *:after{animation-duration:.01s!important;animation-delay:0s!important}#elevar-intro.ei-out{transform:none;opacity:0;transition:opacity .4s}}
`.replace(/\n/g, "");

const HEAD = `<link rel="preload" as="image" href="${LOGO}"><style id="elevar-intro-css">${CSS}</style><script>try{if(sessionStorage.getItem("elevar-intro"))document.documentElement.classList.add("ei-seen")}catch(e){}</script>`;

const SCRIPT = `<script>(function(){var el=document.getElementById("elevar-intro");if(!el)return;if(document.documentElement.classList.contains("ei-seen")){el.remove();return}try{sessionStorage.setItem("elevar-intro","1")}catch(e){}var t0=Date.now(),done=false;function hide(){if(done)return;done=true;setTimeout(function(){el.classList.add("ei-out");setTimeout(function(){el.remove()},1000)},Math.max(0,1900-(Date.now()-t0)))}if(document.readyState==="complete")hide();else window.addEventListener("load",hide);setTimeout(hide,3600)})();</script>`;

export function injectIntro(html, { tagline = "Architecture That Elevates", enabled = true } = {}) {
  if (!enabled || html.includes('id="elevar-intro"') || !/<body[^>]*>/i.test(html)) return html;
  const body = `<div id="elevar-intro" aria-hidden="true"><div class="ei-box"><img src="${LOGO}" alt="" width="1290" height="500" decoding="sync"><div class="ei-line"></div>${tagline ? `<div class="ei-tag">${esc(tagline)}</div>` : ""}</div></div>${SCRIPT}`;
  return html.replace(/<\/head>/i, HEAD + "</head>").replace(/<body[^>]*>/i, (m) => m + body);
}
