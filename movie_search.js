const axios = require('axios');
const cheerio = require('cheerio');
const pool = require('./db');

async function get_info_from_tmdb(id_filme) {
  try {
    const url = `https://www.themoviedb.org/movie/${id_filme}`;
    const { data: html } = await axios.get(url, {
      headers: {
        "User-Agent": "Mozilla/5.0",
        "Accept-Language": "en-US,en;q=0.9"
      }
    });

    const $ = cheerio.load(html);

    const titulo = $('div.title a').first().text().trim() || "Error fetching title";

    const ano = $('span.release_date')
      .first()
      .text()
      .trim()
      .match(/\d{4}/)?.[0] || "Error fetching year";

    const duracao = $('span.runtime').text().trim() || "Error fetching duration";

    const sinopse = $('div.overview p').first().text().trim() || "Error fetching synopsis";

    const poster = $('div.image_content img.poster').attr('src')
      ? `${$('div.image_content img.poster').attr('src')}`
      : "https://upload.wikimedia.org/wikipedia/commons/archive/c/c2/20170513175702%21No_image_poster.png";


    let score = $('div.user_score_chart').attr('data-percent') || "N/A";

    if (score != "N/A" && score.length == 2) { score = `${score[0]}.${score[1]}` }
    if (score != "N/A" && score.length == 1) { score = `0.${score[0]}` }

    let diretor = "Error fetching director";
    $('ol.people li.profile').each((_, el) => {
      const role = $(el).find('.character').text().toLowerCase();
      if (role.includes("director")) {
        diretor = $(el).find('a').first().text().trim();
        return false;
      }
    });

    return {
      titulo,
      ano,
      duracao,
      sinopse,
      poster,
      diretor,
      imdb_id: id_filme,
      imdb_rate: score
    };
  } catch (error) {
    console.error("Erro ao buscar dados do TMDb:", error.message);
    return null;
  }
}


async function search_movie_on_tmdb(filme) {
  try {
    const url = `https://www.themoviedb.org/search/movie?query=${encodeURIComponent(filme)}`;
    console.log(`Making a request on: ${url}`)
    const { data: html } = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0',
        "Accept-Language": "en-US,en;q=0.9"
      }
    });

    const $ = cheerio.load(html);
    const resultados = []

    $('.card.v4.tight').each((i, el) => {
      const container = $(el);

      const title = container.find('h2').first().text().trim();
      const link = container.find('a.result').first().attr('href');
      const mediaType = container.find('a.result').attr('data-media-type');
      const releaseDateRaw = container.find('.release_date').first().text().trim();
      const year = releaseDateRaw.match(/\d{4}/)?.[0] || "Unknown";
      const image = container.find('.poster.w-full').attr('src') || "https://upload.wikimedia.org/wikipedia/commons/archive/c/c2/20170513175702%21No_image_poster.png";

      if (mediaType == "movie") {
        resultados.push({
          title,
          year,
          link,
          image
        })
      }
    })

    return resultados;
  } catch (error) {
    console.error("Erro ao buscar filme no TMDb:", error.message);
    return [];
  }
}


async function search_movie_on_db(id_filme) {
  try {
    const [result] = await pool.query(
      `SELECT * FROM filmes WHERE imdb_id = ?`, [id_filme]
    );

    if (result.length < 1) {
      console.log(`❌ Filme ${id_filme} não encontrado no banco de dados`);
      return null;
    }

    return result;
  } catch (err) {
    console.error('Erro ao consultar o banco de dados:', err);
    return null;
  }
}

module.exports = { search_movie_on_db, search_movie_on_tmdb, get_info_from_tmdb };
