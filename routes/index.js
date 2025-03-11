const { v4: uuid } = require('uuid');
const router = require('express').Router();

router.use((req, res, next) => {
  req.identifier = uuid();
  console.log(
    `API hit with id: ${req.identifier} ${req.url} ${req.method} ${req.headers['user-agent']} ${JSON.stringify(req.body)}`
  );
  next();
});
router.use((req, res) => {
  console.warn(
    `404 Not found. Id: ${req.identifier} ${req.url} ${req.method} ${
      req.headers['user-agent']
    } ${JSON.stringify(req.body)}`,
    'warn'
  );
  return res.status(404).json({
    success: false,
    msg: '404 Not found',
  });
});

module.exports = router;
