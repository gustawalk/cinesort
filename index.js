const {
  search_movie_on_imdb,
  search_movie_on_db,
  get_info_from_imdb,
} = require("./movie_search");
const {
  hash_password,
  compare_hash_password
} = require("./password_hash");
const {
  isNumber
} = require("./config")
const express = require("express");
const session = require("express-session");
require("dotenv").config();
const pool = require("./db");
const path = require("path");
const puppeteerConf = require("./config");
const app = express();
const port = process.env.PORT;

app.use(
  session({
    secret: process.env.SESSION_KEY,
    resave: false,
    saveUninitialized: true,
    cookie: {
      secure: false,
      maxAge: 24 * 60 * 60 * 1000
    },
  }),
);
app.use(express.json());

app.use(express.static(path.join(__dirname, "public")));

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

app.get("/login", reverseAuthMiddleware, (req, res) => {
  res.render("login");
});

app.get("/register", reverseAuthMiddleware, (req, res) => {
  res.render("register");
});

app.get("/", authMiddleware, (req, res) => {
  res.render("search_movies");
});

app.get("/api/user-watched-count", async (req, res) => {
  let user_id
  try {
    user_id = req.session.user.id;
  } catch (error) {
    console.log(error);
    return;
  }
  if (!user_id) return res.status(404).json({ error: "Invalido" });

  const [count] = await pool.query(
    'SELECT COUNT(*) AS count FROM watched_movies WHERE id_user = ?', [user_id]
  );
  const [diff_count] = await pool.query(
    'SELECT COUNT(DISTINCT id_movie) AS diff_count FROM watched_movies WHERE id_user = ?', [user_id]
  );

  return res.status(200).json({ watchedCount: count[0].count, watchedDiffCount: diff_count[0].diff_count });
});

app.post("/api/list/sort", async (req, res) => {
  const { list_id } = req.body;
  if (list_id == undefined) return res.status(404).json({ error: "Invalido" });

  const user_id = req.session.user.id;

  const [rows] = await pool.query(
    `SELECT ml.* FROM movie_lists AS ml JOIN listas ON ml.id_lista_origem = ? AND listas.id_user_dono = ? ORDER BY RAND() LIMIT 1`, [list_id, user_id]
  );
  if (rows.length == 0) return res.status(401).json({ error: "Nenhum filme na lista" });

  const [movie_sorted] = await pool.query(
    `SELECT * FROM filmes WHERE imdb_id = ?`, [rows[0].movie_imdb_id]
  );
  if (movie_sorted.length == 0) return res.status(401).json({ error: "Nenhum filme foi encontrado!" });

  const [user_from_list] = await pool.query(
    `SELECT listas.id_user_dono FROM movie_lists JOIN listas ON listas.id = movie_lists.id_lista_origem WHERE movie_lists.id_lista_origem = ? LIMIT 1`, [list_id]
  );

  await pool.query(
    `INSERT INTO watched_movies (id_user, id_movie, name_movie) VALUES (?, ?, ?)`, [user_from_list[0].id_user_dono, movie_sorted[0].imdb_id, movie_sorted[0].titulo]
  );
  await pool.query(
    `DELETE FROM movie_lists WHERE movie_imdb_id = ? AND id_lista_origem = ?`, [rows[0].movie_imdb_id, list_id]
  );
  res.status(200).json({ rows: movie_sorted });
});

app.delete("/api/list/delete", async (req, res) => {
  const { list_id } = req.body;
  const user_id = req.session.user.id;
  if (list_id == undefined) return res.status(404).json({ error: "Invalido" });

  await pool.query(`DELETE FROM listas WHERE id = ? AND id_user_dono = ?`, [list_id, user_id]);
  await pool.query(`
    DELETE ml
    FROM movie_lists AS ml
    JOIN listas ON ml.id_lista_origem = listas.id
    WHERE ml.id_lista_origem = ? AND listas.id_user_dono = ?
  `, [list_id, user_id]);

  res.status(200).json({ ok: "Ok" });
});

app.post("/api/list/edit", async (req, res) => {
  if (!req.session.user) return res.status(404).json({ Error: "Erro ao pesquisar" });

  const { list_id } = req.body;
  if (list_id == undefined) return res.status(404).json({ error: "Invalido" });

  const user_id = req.session.user.id;

  const [rows] = await pool.query(
    `SELECT ml.* FROM movie_lists AS ml JOIN listas ON ml.id_lista_origem = listas.id WHERE ml.id_lista_origem = ? AND listas.id_user_dono = ?`, [list_id, user_id]
  );

  const final_movies_info = [];
  for (const movies of rows) {
    const [movie_info] = await pool.query(
      `SELECT * FROM filmes WHERE imdb_id = ?`, [movies.movie_imdb_id]
    );
    final_movies_info.push(...movie_info);
  }

  return res.status(200).json({ movies: final_movies_info });
});

app.post("/api/list/create", async (req, res) => {
  if (!req.session.user) return res.status(404).json({ Error: "Erro ao pesquisar" });

  const { list_name } = req.body;
  const user_id = req.session.user.id;

  const [rows] = await pool.query(
    `SELECT id FROM listas WHERE nome_lista = ? AND id_user_dono = ?`, [list_name, user_id]
  );
  if (rows.length != 0) return res.status(409).json({ error: "Ja existe uma lista com esse nome" });

  await pool.query(
    `INSERT INTO listas (id_user_dono, nome_lista) VALUES (?, ?)`, [user_id, list_name]
  );

  return res.status(200).json({ ok: "Ok" });
});

app.post("/api/list/add", async (req, res) => {
  const { movie_imdb_id, list_id } = req.body;

  try {
    const [rows] = await pool.query(
      `SELECT * FROM movie_lists WHERE id_lista_origem = ? AND movie_imdb_id = ?`, [list_id, movie_imdb_id]
    );
    if (rows.length !== 0) return res.status(409).json({ error: "O filme já está na lista selecionada" });

    await pool.query(
      `INSERT INTO movie_lists (id_lista_origem, movie_imdb_id) VALUES (?, ?)`, [list_id, movie_imdb_id]
    );

    return res.status(200).json({ ok: "Filme adicionado com sucesso" });
  } catch (error) {
    return res.status(500).json({ error: "Erro interno no servidor" });
  }
});

app.post("/api/list/edit/delete", async (req, res) => {
  const { movie_id, list_id } = req.body;

  await pool.query(
    `DELETE FROM movie_lists WHERE movie_imdb_id = ? AND id_lista_origem = ?`, [movie_id, list_id]
  );

  return res.status(200).json({ ok: "Ok" });
});

app.get("/api/user-list", async (req, res) => {
  const user_id = req.session.user ? req.session.user.id : null;
  if (user_id == null) return res.status(401).json({ error: "Usuário não autenticado" });

  const [rows] = await pool.query(`SELECT * FROM listas WHERE id_user_dono = ?`, [user_id]);
  if (rows.length == 0) return res.status(404).json({ ok: "nenhuma lista foi encontrada" });

  return res.status(200).json(rows);
});

app.get("/search/:movie", async (req, res) => {
  const movie = req.params.movie;
  const movie_info = await search_movie_on_imdb(movie);

  res.json(movie_info);
});

app.get("/detail/:movie", authMiddleware, async (req, res) => {
  const movie_id = req.params.movie;
  res.render("details", { movie_id });
});

function authMiddleware(req, res, next) {
  if (!req.session.user) return res.redirect("/login");
  next();
}

function reverseAuthMiddleware(req, res, next) {
  if (req.session.user) return res.redirect("/");
  next();
}

async function getUserData(user) {
  const [rows] = await pool.query(`SELECT nome_user, id FROM usuarios WHERE nome_user = ?`, [user]);
  if (rows.length > 0) return { name: rows[0].nome_user, id: rows[0].id };
  return null;
}

app.post("/api/register", async (req, res) => {
  const { user, email, password } = req.body;

  function validateEmail(email) {
    const emailPattern = /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/i;
    return emailPattern.test(email);
  }

  if (user.length <= 3 || password.length <= 3)
    return res.status(406).json({ error: "Informacoes minimas nao suficientes" });
  if (!validateEmail(email))
    return res.status(407).json({ error: "Email invalido" });

  try {
    const [rows] = await pool.query(`SELECT * FROM usuarios WHERE nome_user = ? OR email_user = ?`, [user, email]);
    if (rows.length != 0)
      return res.status(409).json({ error: "Usuário ou e-mail já cadastrados" });

    const new_hashed_password = await hash_password(password);

    await pool.query(
      `INSERT INTO usuarios (nome_user, email_user, senha_user) VALUES (?, ?, ?)`,
      [user, email, new_hashed_password]
    );

    const user_data = await getUserData(user);

    req.session.user = {
      name: user_data.name,
      id: user_data.id
    };
    return res.status(200).json({ ok: "Register sucessffuly!" });
  } catch (error) {
    return res.status(500).json({ error: "Erro interno do servidor" });
  }
});

app.post("/api/login", async (req, res) => {
  const { user, password } = req.body;

  const [user_info] = await pool.query(`SELECT * FROM usuarios WHERE nome_user = ?`, [user]);
  if (user_info.length == 0)
    return res.status(401).json({ error: "Credenciais inválidas" });

  const match_pass = await compare_hash_password(password, user_info[0].senha_user);
  if (!match_pass)
    return res.status(401).json({ error: "Credenciais inválidas" });

  req.session.user = {
    name: user_info[0].nome_user,
    id: user_info[0].id
  };

  return res.status(200).json({ ok: "Login suceffuly!" });
});

app.get("/logout", (req, res) => {
  req.session.destroy(() => {
    res.redirect("/login");
  });
});

app.get("/api/session", (req, res) => {
  if (req.session.user) {
    return res.json({ loggedIn: true, user: req.session.user });
  }
  res.json({ loggedIn: false });
});

app.get("/api/detail/:movie", async (req, res) => {
  const movie_id = req.params.movie;
  const movie_info = await search_movie_on_db(movie_id);

  if (movie_info == null) {
    const movie_data = await get_info_from_imdb(movie_id);
    await pool.query(
      `INSERT INTO filmes (titulo, sinopse, ano, duracao, diretor, poster, imdb_id) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        movie_data.titulo,
        movie_data.sinopse,
        movie_data.ano,
        movie_data.duracao,
        movie_data.diretor,
        movie_data.poster,
        movie_data.imdb_id,
      ]
    );

    return res.json(movie_data);
  }

  res.json(movie_info[0]);
});

app.listen(port, '0.0.0.0', () => {
  console.log(`App running on port:${port}`);
});
