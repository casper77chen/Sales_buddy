module.exports = {
  ensureAuthenticated(req, res, next) {
    if (req.isAuthenticated()) {
      return next();
    }
    req.flash('error_msg', '請先登入');
    res.redirect('/auth/login');
  },

  ensureAdmin(req, res, next) {
    if (req.isAuthenticated() && req.user.role === 'admin') {
      return next();
    }
    req.flash('error_msg', '權限不足');
    res.redirect('/');
  },

  ensureManager(req, res, next) {
    if (req.isAuthenticated() && ['admin', 'gm', 'manager'].includes(req.user.role)) {
      return next();
    }
    req.flash('error_msg', '權限不足');
    res.redirect('/');
  },

  ensureGM(req, res, next) {
    if (req.isAuthenticated() && ['admin', 'gm'].includes(req.user.role)) {
      return next();
    }
    req.flash('error_msg', '權限不足');
    res.redirect('/');
  },
};
