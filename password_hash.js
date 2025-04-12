const bcrypt = require('bcrypt');
const salt_rounds = 10;

async function hash_password(password) {
    try {
        const hash = await bcrypt.hash(password, salt_rounds);
        return hash;
    } catch (err) {
        console.log("Erro ao hashificar senha:", err);
        throw err;
    }
}

async function compare_hash_password(entered_password, stored_hash) {
    try {
        const is_match = await bcrypt.compare(entered_password, stored_hash);
        if (is_match) {
            return true;
        } else {
            return false;
        }
    } catch (err) {
        console.error("Erro ao comparar senha:", err);
        throw err;
    }
}

module.exports = { hash_password, compare_hash_password };
