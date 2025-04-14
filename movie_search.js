const puppeteer = require('puppeteer-extra')
const puppeteerConf = require("./config")
const connection = require('./db');

const StealthPlugin = require('puppeteer-extra-plugin-stealth')
puppeteer.use(StealthPlugin())

async function get_info_from_imdb(id_filme) {
  const browser = await puppeteer.launch({ headless: true, args: ["--no-sandbox"] });
  const page = await browser.newPage();

  await page.setRequestInterception(true);
  page.on('request', (req) => {
    if (['image', 'stylesheet', 'font'].includes(req.resourceType())) {
      req.abort();
    } else {
      req.continue();
    }
  });

  await page.goto(`https://www.imdb.com/title/${id_filme}/`);

  await page.addStyleTag({
    content: '* { animation: none !important; transition: none !important; }'
  });

  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/66.0.3359.181 Safari/537.36');

  await page.waitForSelector(".hero__primary-text");

  const infos = await page.evaluate((id) => {
    const getText = (selector) => document.querySelector(selector)?.innerText || null;
    const getSrc = (selector) => document.querySelector(selector)?.src || null;

    let titulo = getText('.hero__primary-text') || getText('h1') || "Error fetching title";
    const sinopse = getText('.mmImo') || getText('[data-testid="plot"]') || "Error fetching sinopsys";
    let poster = getSrc('.ipc-image');

    const lista_sub_info = document.querySelectorAll('ul.joVhBE .ipc-inline-list__item');
    const metadata = document.querySelectorAll('.ipc-metadata-list-item__list-content-item');

    const ano = lista_sub_info[0]?.innerText || "Error fetching year";
    const duracao = lista_sub_info[2]?.innerText || lista_sub_info[1]?.innerText || "Error fetching movie duration";
    const diretor = metadata[0]?.innerText || "Error fetching director";

    const svg_poster_undefined = document.querySelector('svg.ipc-icon--movie.ipc-media__icon') || null;

    if (svg_poster_undefined != null) {
      poster = "Poster doesnt exist";
    }

    return {
      titulo,
      sinopse,
      ano,
      duracao,
      diretor,
      poster,
      imdb_id: id
    };
  }, id_filme);

  await browser.close();
  return infos;
}

async function search_movie_on_imdb(filme) {
  const browser = await puppeteer.launch({ headless: true, args: ["--no-sandbox"] });
  const page = await browser.newPage();

  await page.goto(`https://www.imdb.com/find/?q=${filme}&s=tt&ttype=ft&ref_=fn_mov`);

  await page.addStyleTag({
    content: '* { animation: none !important; transition: none !important; }'
  });

  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/66.0.3359.181 Safari/537.36');

  const movies = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('.ipc-metadata-list-summary-item')).map(movie => {
      const title = movie.querySelector('.ipc-metadata-list-summary-item__t')?.innerText.trim() || "Error fetching title";
      const year = movie.querySelector('.ipc-metadata-list-summary-item__li')?.innerText.trim() || "Error fetching year";
      const link = movie.querySelector('.ipc-metadata-list-summary-item__t')?.href || "Error fetching link";
      const image = movie.querySelector('.ipc-image')?.src || "Image not found";

      if (year.length == 4) {
        return { title, year, link, image };
      }
      return null;
    })
      .filter(movie => movie !== null);
  });

  await browser.close();
  return movies;
}

async function search_movie_on_db(id_filme) {
  try {
    const [result] = await connection.promise().query(
      `SELECT * FROM filmes WHERE imdb_id = ?`, [id_filme]
    );

    if (result.length < 1) {
      console.log('❌ Filme não encontrado no banco de dados');
      return null;
    } else {
      console.log("Filme encontrado no banco de dados!");
    }

    return result;
  } catch (err) {
    console.error('Erro ao consultar o banco de dados:', err);
    return null;
  }
}

module.exports = { search_movie_on_imdb, get_info_from_imdb, search_movie_on_db }
