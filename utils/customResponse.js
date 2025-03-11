exports.badRequestErrorResponse = (res, msg) => {
  console.warn(`Bad Request Error: ${msg}`);

  return res.status(400).json({
    success: false,
    msg,
  });
};

exports.unauthorizedErrorResponse = (res, msg) => {
  console.warn(`Unauthorized Request Error: ${msg}`);

  return res.status(401).json({
    success: false,
    msg,
  });
};

exports.internalServerErrorResponse = (res, error) => {
  console.error('Internal Server Error: ', error);

  return res.status(500).json({ success: false, msg: error.message });
};

exports.successResponse = (res, msg, data) => {
  console.log(`Api Success: ${msg}`);

  return res.json({ success: true, msg, data });
};
