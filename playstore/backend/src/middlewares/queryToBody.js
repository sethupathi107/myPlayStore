// A handful of GET routes (app/id, app/download, images/, images/appImage)
// read their parameters from req.body instead of the URL. That works from
// curl/Postman, but every real browser (per the XHR/fetch specs) silently
// drops the body on a GET request, so the frontend can never actually reach
// them that way. This middleware lets those same routes also accept the
// parameters as query string values, without breaking any existing caller
// that still sends them in the body.
function queryToBody(req, res, next) {
    req.body = { ...req.query, ...req.body };
    next();
}

export default queryToBody;
