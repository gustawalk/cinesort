module.exports = {
    chromeOptions: {
      headless : false,
      args: ["--no-sandbox", "--disable-setuid-sandbox", "--start-maximized"],
      slowMo: 30,
    },
  };

function isNumber(value){
  return typeof value === "number"
}

module.exports = {isNumber}