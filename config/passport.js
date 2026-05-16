const LocalStrategy = require('passport-local').Strategy;
const bcrypt = require('bcryptjs');
const User = require('../models/User');

module.exports = function (passport) {
  passport.use(
    new LocalStrategy({ usernameField: 'email' }, async (email, password, done) => {
      try {
        const user = await User.findOne({ email });
        if (!user) {
          return done(null, false, { message: '此 Email 尚未註冊' });
        }
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
          return done(null, false, { message: '密碼錯誤' });
        }
        if (!user.isApproved) {
          return done(null, false, { message: '帳號尚未通過審核，請等待 Admin 核准' });
        }
        return done(null, user);
      } catch (err) {
        return done(err);
      }
    })
  );

  passport.serializeUser((user, done) => done(null, user.id));

  passport.deserializeUser(async (id, done) => {
    try {
      const user = await User.findById(id);
      done(null, user);
    } catch (err) {
      done(err);
    }
  });
};
