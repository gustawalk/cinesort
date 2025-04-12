const puppeteer = require('puppeteer-extra')
const puppeteerConf = require("./config")
const connection = require('./db');

const StealthPlugin = require('puppeteer-extra-plugin-stealth')
puppeteer.use(StealthPlugin())

async function get_info_from_imdb(id_filme) {
  const browser = await puppeteer.launch({ headless: true, args: ["--no-sandbox"] })
  const page = await browser.newPage();

  await page.goto(`https://www.imdb.com/title/${id_filme}/`);

  await page.addStyleTag({
    content: '* { animation: none !important; transition: none !important; }'
  });

  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/66.0.3359.181 Safari/537.36')

  await page.waitForSelector(".hero__primary-text");

  const infos = await page.evaluate((id) => {
    const getText = (selector) => document.querySelector(selector)?.innerText || null;
    const getSrc = (selector) => document.querySelector(selector)?.src || null;

    let titulo = getText('.hero__primary-text') || getText('h1') || "Título não disponível";
    const sinopse = getText('.mmImo') || getText('[data-testid="plot"]') || "Sinopse não disponível";
    const poster = getSrc('.ipc-image') || "Poster não disponível";

    const lista_sub_info = document.querySelectorAll('ul.joVhBE .ipc-inline-list__item');
    const metadata = document.querySelectorAll('.ipc-metadata-list-item__list-content-item');

    const ano = lista_sub_info[0]?.innerText || "Ano não disponível";
    const duracao = lista_sub_info[2]?.innerText || lista_sub_info[1]?.innerText || "Duração não disponível";
    const diretor = metadata[0]?.innerText || "Diretor não disponível";

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
      const title = movie.querySelector('.ipc-metadata-list-summary-item__t')?.innerText.trim() || "Título não encontrado";
      const year = movie.querySelector('.ipc-metadata-list-summary-item__li')?.innerText.trim() || "Ano nao encontrado";
      const link = movie.querySelector('.ipc-metadata-list-summary-item__t')?.href || "Link não encontrado";
      const image = movie.querySelector('.ipc-image')?.src || "Imagem não encontrada";

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
