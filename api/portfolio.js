var fs = require('fs');
var path = require('path');

module.exports = function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  try {
    var file = path.join(__dirname, '..', 'data', 'portfolio.json');
    var data = JSON.parse(fs.readFileSync(file, 'utf-8'));
    res.status(200).json(data);
  } catch (e) {
    res.status(200).json({ items: [] });
  }
};
