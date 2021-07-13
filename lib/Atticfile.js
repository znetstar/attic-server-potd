const fetch = require('node-fetch');
const cheerio = require('cheerio');

const P = require('puppeteer');

class AtticServerPOTD {
  constructor(ctx) { this.ctx = ctx; }

  async init() {


    const { mongoose, config } = this.ctx;

    config.resolverTypes.push('POTDResolver')
    const POTDResolverSchema = (new (mongoose.Schema)({}))

    POTDResolverSchema.methods.resolve = async function (location) {
          if (typeof(location) === 'string')
            location = { href: location };

          let inUrl = require('url').parse(location.href);
          let pathname = inUrl.pathname;
          if (pathname !== '/potd/nasa' && pathname !== '/potd/wiki' && pathname !== '/potd/xkcd') {
            return null;
          }

          let entity;

          let outUrl;
           if (pathname === '/potd/nasa') {
             const buf = await (async () => {
               const browser = await require('puppeteer').launch({
                 headless: false,
                 args: [
                   "--enable-logging",
                   "--v-",
                   "--no-sandbox",
                   "--disable-setuid-sandbox",
                   "--enable-logging",
                   "--window-size=1920,1080",
                   "--disable-extensions",
                   "--start-maximized",
                   "--allow-running-insecure-content",
                   "--disable-gpu",
                   '--disable-web-security'
                 ]
               });

               let page = await browser.newPage();

               await page.setViewport({
                 width: 1920,
                 height: 1080
               })

               await page.goto('https://apod.nasa.gov/apod/', {timeout: 0});

               await page.addScriptTag({ path: './node_modules/jquery/dist/jquery.min.js' });
               await page.waitFor(10e3);
               await page.evaluate((stuff) => {
                 let psa = (Array.from($('p').map(function () {
                   return {x: [$(this).height(), this]};
                 })).map((h) => h.x));
                 let ps = new Map();
                 for (let [k, v] of psa) {
                   !ps.has(k) && ps.set(k, v);
                 }


                 let largestKey;
                 for (let k of Array.from(ps.keys())) {
                   if (!largestKey || largestKey < k) {
                     largestKey = k;
                   }
                 }

                 let largestValue = $(ps.get(largestKey));

                 largestValue = $(':not("br")', largestValue).first()[0];

                 document.write(largestValue.outerHTML);
               });

               let buf = await page.screenshot({type: 'jpeg', fullPage: true, omitBackground: true});
               await browser.close();
               return buf;
             })()

             let id = require('moment')().format('YYMMDD');

             entity = new mongoose.models.HTTPResourceEntity({
               "source" : {
                 "href" : `https://apod.nasa.gov/apod/ap${id}`
               },
               status: 200,
               "type" : "HTTPResourceEntity",
               headers: {
                 'Content-Type': 'image/jpeg'
               },
               body: buf,
               "__v" : 0
             });
          } else if (pathname === '/potd/wiki') {
            let page = await (await fetch('https://commons.wikimedia.org/wiki/Main_Page')).text();
            let $ = cheerio.load(page);
            outUrl = $('#mainpage-potd img').attr('src');
            outUrl = outUrl.replace('/thumb', '').split('/').slice(0, -1).join('/');
            if (outUrl.substr(0, 4) !== 'http') {
              outUrl = `https://commons.wikimedia.org/${outUrl}`;
            }
          } else if (pathname === '/potd/xkcd') {
            let page = await (await fetch('https://xkcd.com/')).text();
            let $ = cheerio.load(page);
            outUrl = $('#comic img').attr('src');
            if (outUrl.substr(0, 4) !== 'http') {
              outUrl = `https:${outUrl}`;
            }
          }

          entity = entity || new mongoose.models.HTTPResourceEntity({
            "source" : {
              "href" : outUrl
            },
            status: 302,
            "type" : "HTTPResourceEntity",
            "__v" : 0
          });

          let midnight = (new Date());
          midnight.setHours(0);
          midnight.setMinutes(0);
          midnight.setSeconds(0);
          midnight.setMinutes(0);
          midnight.setDate(midnight.getDate() + 1);

          let cacheExpireIn = midnight.getTime() - (new Date().getTime())

          let outLocation = new mongoose.models.Location({
            "href" : location.href,
            "entity" : entity,
            "driver" : "HTTPRedirectDriver",
            cacheExpireIn
          });

          location.cacheExpireIn = cacheExpireIn;

          return outLocation;
      };
      const POTDResolver = mongoose.models.Resolver.discriminator('POTDResolver', POTDResolverSchema);
   }

  get name() {
    return '@znetstar/attic-server-potd';
  }
}

module.exports = { default: AtticServerPOTD };
