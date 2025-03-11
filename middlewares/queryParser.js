const { badRequestErrorResponse } = require('../utils/customResponse');
module.exports = (req, res, next) => {
  try {
    const parsedQuery = {};
    for (const [key, value] of Object.entries(req.query)) {
      if (
        ['null', 'true', 'false', 'undefined'].includes(value) ||
        /^(\[.*\]|\{.*\})$/.test(value)
      ) {
        parsedQuery[key] = JSON.parse(value);
      } else if (!isNaN(value)) {
        parsedQuery[key] = parseFloat(value);
      } else {
        parsedQuery[key] = value;
      }
    }
    req.query = parsedQuery;
    next();
  } catch (error) {
    badRequestErrorResponse(res, error.message);
  }
};
