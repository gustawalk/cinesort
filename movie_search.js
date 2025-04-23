const axios = require('axios');
const cheerio = require('cheerio');
const pool = require('./db');

function check_poster(poster) {
  let first_poster = poster.first();
  let poster_sizes = first_poster.attr("sizes");

  if (poster_sizes != "50vw, (min-width: 480px) 34vw, (min-width: 600px) 26vw, (min-width: 1024px) 16vw, (min-width: 1280px) 16vw") {
    return `
          https://upload.wikimedia.org/wikipedia/commons/archive/c/c2/20170513175702%21No_image_poster.png
    `
  }
  return first_poster.attr('src');
}

async function get_info_from_imdb(id_filme) {
  try {
    const url = `https://www.imdb.com/title/${id_filme}/`;
    const { data: html } = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0'
      }
    });

    const $ = cheerio.load(html);

    const getText = (selector) => $(selector).first().text().trim() || null;

    const titulo = getText('.hero__primary-text') || getText('h1') || "Error fetching title";

    let sinopse = $('[data-testid="plot-l"]').text().trim();

    if (!sinopse) sinopse = $('[data-testid="plot-xs_to_m"]').text().trim();
    if (!sinopse) sinopse = $('[data-testid="plot-xl"]').text().trim();
    if (!sinopse) sinopse = "Error fetching synopsis";

    sinopse = sinopse.replace(/Read all\s*$/i, '').trim();

    let poster_raw = $('.ipc-image');

    const lista_sub_info = $('.cMcwpt .ipc-inline-list__item');
    const metadata = $('.ipc-metadata-list-item__list-content-item');

    const ano = lista_sub_info.eq(0).text().trim() || "Error fetching year";
    const duracao = lista_sub_info.eq(2).text().trim() || lista_sub_info.eq(1).text().trim() || "Error fetching movie duration";
    const diretor = metadata.eq(0).text().trim() || "Error fetching director";

    let poster = check_poster(poster_raw)
    const imdb_rate = $('div[data-testid="hero-rating-bar__aggregate-rating__score"] span').first().text();

    return {
      titulo,
      sinopse,
      ano,
      duracao,
      diretor,
      poster,
      imdb_id: id_filme,
      imdb_rate
    };
  } catch (error) {
    console.error("Erro ao buscar dados do IMDb:", error.message);
    return null;
  }
}

async function search_movie_on_imdb(filme) {
  try {
    const url = `https://www.imdb.com/find/?q=${encodeURIComponent(filme)}&s=tt&ttype=ft&ref_=fn_mov`;
    const { data: html } = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0'
      }
    });

    const $ = cheerio.load(html);
    const resultados = [];

    $('.ipc-metadata-list-summary-item').each((i, el) => {
      const title = $(el).find('.ipc-metadata-list-summary-item__t').text().trim() || "Error fetching title";
      const year = $(el).find('.ipc-metadata-list-summary-item__li').first().text().trim() || "Error fetching year";
      const link = $(el).find('.ipc-metadata-list-summary-item__t').attr('href') || "Error fetching link";
      const image = $(el).find('.ipc-image').attr('src') || "Image not found";

      if (year.length === 4) {
        resultados.push({
          title,
          year,
          link,
          image
        });
      }
    });

    return resultados;
  } catch (error) {
    console.error("Erro ao buscar filme no IMDb:", error.message);
    return [];
  }
}

async function search_movie_on_db(id_filme) {
  try {
    const [result] = await pool.query(
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

module.exports = { search_movie_on_imdb, get_info_from_imdb, search_movie_on_db };
