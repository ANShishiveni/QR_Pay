// NamPay clients use the authenticated Express API. Firebase Admin access stays
// on the backend; importing this legacy module must not initialize a production
// project, analytics or a second identity/session system.
export const auth = null;
export const database = null;
export const analytics = null;
export default null;
