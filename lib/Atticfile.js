const fetch = require('node-fetch');
const cheerio = require('cheerio');

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
          if (pathname !== '/potd/nasa' && pathname !== '/potd/wiki') {
            return null;
          }

          let outUrl;
          if (pathname === '/potd/nasa') {
            let page = await (await fetch('https://apod.nasa.gov/apod/')).text();
            let $ = cheerio.load(page);
            outUrl = $('img[style="max-width:100%"]').attr('src');
            if (outUrl.substr(0, 4) !== 'http') {
              outUrl = `https://apod.nasa.gov/apod/${outUrl}`;
            }
          } else if (pathname === '/potd/wiki') {
            let page = await (await fetch('https://commons.wikimedia.org/wiki/Main_Page')).text();
            let $ = cheerio.load(page);
            outUrl = $('#mainpage-potd img').attr('src');
            outUrl = outUrl.replace('/thumb', '').split('/').slice(0, -1).join('/');
            if (outUrl.substr(0, 4) !== 'http') {
              outUrl = `https://commons.wikimedia.org/${outUrl}`;
            }
          }

          let entity = new mongoose.models.HTTPResourceEntity({
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
