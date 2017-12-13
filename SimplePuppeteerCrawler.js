const puppeteer = require('puppeteer');
const fs = require('fs');
const { URL } = require('url');
// Use URl consturctor to lookup matching host on page later on
const MAIN_URL = new URL('http://www.example.com');

let queue = [MAIN_URL.href];
var visitedURL = [];
const WEBSITE = queue[0];
const limitCrawl = 500; // Crawl safely for big site can last hours

console.time('crawler');

(async () => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  await page.setRequestInterception(true);

  let requestURLs = [];
// speed up app by aborting requests not needed to gather links
  page.on('request', interceptedRequest => {
    if (/css|jpg|png|svg|font/.test(interceptedRequest.url)) {
      interceptedRequest.abort();
    } else {
      interceptedRequest.continue();
      requestURLs.push(interceptedRequest.url);
    }
  });

  const currentPageURLs = [];
  let currentURL;
  while (await queue.length > 0 && await visitedURL.length < limitCrawl) {

    var gotoPage = null;

    try {gotoPage = await page.goto(queue[0], {waitUntil:['load', 'domcontentloaded', 'networkidle2'] }); } catch (e) { console.error('ERROR', queue[0], e) };
// if page go to returns an err, let's skip that url but not break out of the app
    if (gotoPage !== null) {

      const hostname = await page.evaluate(() => window.location.hostname);

      if (hostname == MAIN_URL.hostname) {
        const hrefs = await page.evaluate(
          () => Array.from(document.body.querySelectorAll('a[href]'), ({ href }) => href)
        );

        for (const href of hrefs) {
          if (new RegExp('^(https?:\/\/)?' + hostname).test(href) && !/pdf$/.test(href)) {
            currentPageURLs.push(href.replace(/#.*/, ''));
          }
        }
      }

    }

    currentURL = queue.shift();

    requestURLs = []; //reset request list
//CONSOLE out URL's or write files for each list
    visitedURL.push(currentURL);
    //console.log('VISTED', visitedURL);
    //fs.writeFile("/tmp/visitedURL.csv", visitedURL.join().replace(/,/g, '\n'), () => { });
    let uniqueList = [...new Set(currentPageURLs)];
    //console.log('UNIQUE',uniqueList);
    //fs.writeFile("/tmp/uniqueList.csv", uniqueList.join().replace(/,/g, '\n'), () => { });
    queue = queue.concat(uniqueList).filter(v => !visitedURL.includes(v));
    //console.log('QUEUE', queue);
    //fs.writeFile("/tmp/queue.csv", queue.join().replace(/,/g, '\n'), () => { });
  }
  await browser.close();
  console.timeEnd('crawler');

  fs.writeFile("/tmp/"+MAIN_URL.hostname+"_SiteMap.txt", visitedURL.join().replace(/,/g, '\n'), () => { });

})();