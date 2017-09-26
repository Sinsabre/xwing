
/*
    X-Wing Squad Builder
    Geordan Rosario <geordan@gmail.com>
    https://github.com/geordanr/xwing
 */
var DFL_LANGUAGE, GenericAddon, SERIALIZATION_CODE_TO_CLASS, SPEC_URL, SQUAD_DISPLAY_NAME_MAX_LENGTH, Ship, TYPES, URL_BASE, builders, byName, byPoints, conditionToHTML, exportObj, getPrimaryFaction, sortWithoutQuotes, statAndEffectiveStat, _base,
  __slice = [].slice,
  __bind = function(fn, me){ return function(){ return fn.apply(me, arguments); }; },
  __indexOf = [].indexOf || function(item) { for (var i = 0, l = this.length; i < l; i++) { if (i in this && this[i] === item) return i; } return -1; },
  __hasProp = {}.hasOwnProperty,
  __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };

window.iced = {
  Deferrals: (function() {
    function _Class(_arg) {
      this.continuation = _arg;
      this.count = 1;
      this.ret = null;
    }

    _Class.prototype._fulfill = function() {
      if (!--this.count) {
        return this.continuation(this.ret);
      }
    };

    _Class.prototype.defer = function(defer_params) {
      ++this.count;
      return (function(_this) {
        return function() {
          var inner_params, _ref;
          inner_params = 1 <= arguments.length ? __slice.call(arguments, 0) : [];
          if (defer_params != null) {
            if ((_ref = defer_params.assign_fn) != null) {
              _ref.apply(null, inner_params);
            }
          }
          return _this._fulfill();
        };
      })(this);
    };

    return _Class;

  })(),
  findDeferral: function() {
    return null;
  },
  trampoline: function(_fn) {
    return _fn();
  }
};
window.__iced_k = window.__iced_k_noop = function() {};

exportObj = typeof exports !== "undefined" && exports !== null ? exports : this;

exportObj.SquadBuilderBackend = (function() {

  /*
      Usage:
  
          rebel_builder = new SquadBuilder
              faction: 'Rebel Alliance'
              ...
          empire_builder = new SquadBuilder
              faction: 'Galactic Empire'
              ...
          backend = new SquadBuilderBackend
              server: 'https://xwing.example.com'
              builders: [ rebel_builder, empire_builder ]
              login_logout_button: '#login-logout'
              auth_status: '#auth-status'
   */
  function SquadBuilderBackend(args) {
    this.getLanguagePreference = __bind(this.getLanguagePreference, this);
    this.nameCheck = __bind(this.nameCheck, this);
    this.maybeAuthenticationChanged = __bind(this.maybeAuthenticationChanged, this);
    var builder, _i, _len, _ref;
    $.ajaxSetup({
      dataType: "json",
      xhrFields: {
        withCredentials: true
      }
    });
    this.server = args.server;
    this.builders = args.builders;
    this.login_logout_button = $(args.login_logout_button);
    this.auth_status = $(args.auth_status);
    this.authenticated = false;
    this.ui_ready = false;
    this.oauth_window = null;
    this.method_metadata = {
      google_oauth2: {
        icon: 'fa fa-google-plus-square',
        text: 'Google'
      },
      facebook: {
        icon: 'fa fa-facebook-square',
        text: 'Facebook'
      },
      twitter: {
        icon: 'fa fa-twitter-square',
        text: 'Twitter'
      }
    };
    this.squad_display_mode = 'all';
    this.collection_save_timer = null;
    this.setupHandlers();
    this.setupUI();
    this.authenticate((function(_this) {
      return function() {
        return _this.auth_status.hide();
      };
    })(this));
    _ref = this.builders;
    for (_i = 0, _len = _ref.length; _i < _len; _i++) {
      builder = _ref[_i];
      builder.setBackend(this);
    }
    this.updateAuthenticationVisibility();
  }

  SquadBuilderBackend.prototype.updateAuthenticationVisibility = function() {
    if (this.authenticated) {
      $('.show-authenticated').show();
      return $('.hide-authenticated').hide();
    } else {
      $('.show-authenticated').hide();
      return $('.hide-authenticated').show();
    }
  };

  SquadBuilderBackend.prototype.save = function(serialized, id, name, faction, additional_data, cb) {
    var post_args, post_url;
    if (id == null) {
      id = null;
    }
    if (additional_data == null) {
      additional_data = {};
    }
    if (serialized === "") {
      return cb({
        id: null,
        success: false,
        error: "You cannot save an empty squad"
      });
    } else if ($.trim(name) === "") {
      return cb({
        id: null,
        success: false,
        error: "Squad name cannot be empty"
      });
    } else if ((faction == null) || faction === "") {
      throw "Faction unspecified to save()";
    } else {
      post_args = {
        name: $.trim(name),
        faction: $.trim(faction),
        serialized: serialized,
        additional_data: additional_data
      };
      if (id != null) {
        post_url = "" + this.server + "/squads/" + id;
      } else {
        post_url = "" + this.server + "/squads/new";
        post_args['_method'] = 'put';
      }
      return $.post(post_url, post_args, (function(_this) {
        return function(data, textStatus, jqXHR) {
          return cb({
            id: data.id,
            success: data.success,
            error: data.error
          });
        };
      })(this));
    }
  };

  SquadBuilderBackend.prototype["delete"] = function(id, cb) {
    var post_args;
    post_args = {
      '_method': 'delete'
    };
    return $.post("" + this.server + "/squads/" + id, post_args, (function(_this) {
      return function(data, textStatus, jqXHR) {
        return cb({
          success: data.success,
          error: data.error
        });
      };
    })(this));
  };

  SquadBuilderBackend.prototype.list = function(builder, all) {
    var list_ul, loading_pane, url;
    if (all == null) {
      all = false;
    }
    if (all) {
      this.squad_list_modal.find('.modal-header .squad-list-header-placeholder').text("Everyone's " + builder.faction + " Squads");
    } else {
      this.squad_list_modal.find('.modal-header .squad-list-header-placeholder').text("Your " + builder.faction + " Squads");
    }
    list_ul = $(this.squad_list_modal.find('ul.squad-list'));
    list_ul.text('');
    list_ul.hide();
    loading_pane = $(this.squad_list_modal.find('p.squad-list-loading'));
    loading_pane.show();
    this.show_all_squads_button.click();
    this.squad_list_modal.modal('show');
    url = all ? "" + this.server + "/all" : "" + this.server + "/squads/list";
    return $.get(url, (function(_this) {
      return function(data, textStatus, jqXHR) {
        var li, squad, _i, _len, _ref;
        if (data[builder.faction].length === 0) {
          list_ul.append($.trim("<li>You have no squads saved.  Go save one!</li>"));
        } else {
          _ref = data[builder.faction];
          for (_i = 0, _len = _ref.length; _i < _len; _i++) {
            squad = _ref[_i];
            li = $(document.createElement('LI'));
            li.addClass('squad-summary');
            li.data('squad', squad);
            li.data('builder', builder);
            list_ul.append(li);
            li.append($.trim("<div class=\"row-fluid\">\n    <div class=\"span9\">\n        <h4>" + squad.name + "</h4>\n    </div>\n    <div class=\"span3\">\n        <h5>" + squad.additional_data.points + " Points</h5>\n    </div>\n</div>\n<div class=\"row-fluid squad-description\">\n    <div class=\"span8\">\n        " + squad.additional_data.description + "\n    </div>\n    <div class=\"span4\">\n        <button class=\"btn load-squad\">Load</button>\n        &nbsp;\n        <button class=\"btn btn-danger delete-squad\">Delete</button>\n    </div>\n</div>\n<div class=\"row-fluid squad-delete-confirm\">\n    <div class=\"span8\">\n        Really delete <em>" + squad.name + "</em>?\n    </div>\n    <div class=\"span4\">\n        <button class=\"btn btn-danger confirm-delete-squad\">Delete</button>\n        &nbsp;\n        <button class=\"btn cancel-delete-squad\">Cancel</button>\n    </div>\n</div>"));
            li.find('.squad-delete-confirm').hide();
            li.find('button.load-squad').click(function(e) {
              var button;
              e.preventDefault();
              button = $(e.target);
              li = button.closest('li');
              builder = li.data('builder');
              _this.squad_list_modal.modal('hide');
              if (builder.current_squad.dirty) {
                return _this.warnUnsaved(builder, function() {
                  return builder.container.trigger('xwing-backend:squadLoadRequested', li.data('squad'));
                });
              } else {
                return builder.container.trigger('xwing-backend:squadLoadRequested', li.data('squad'));
              }
            });
            li.find('button.delete-squad').click(function(e) {
              var button;
              e.preventDefault();
              button = $(e.target);
              li = button.closest('li');
              builder = li.data('builder');
              return (function(li) {
                return li.find('.squad-description').fadeOut('fast', function() {
                  return li.find('.squad-delete-confirm').fadeIn('fast');
                });
              })(li);
            });
            li.find('button.cancel-delete-squad').click(function(e) {
              var button;
              e.preventDefault();
              button = $(e.target);
              li = button.closest('li');
              builder = li.data('builder');
              return (function(li) {
                return li.find('.squad-delete-confirm').fadeOut('fast', function() {
                  return li.find('.squad-description').fadeIn('fast');
                });
              })(li);
            });
            li.find('button.confirm-delete-squad').click(function(e) {
              var button;
              e.preventDefault();
              button = $(e.target);
              li = button.closest('li');
              builder = li.data('builder');
              li.find('.cancel-delete-squad').fadeOut('fast');
              li.find('.confirm-delete-squad').addClass('disabled');
              li.find('.confirm-delete-squad').text('Deleting...');
              return _this["delete"](li.data('squad').id, function(results) {
                if (results.success) {
                  return li.slideUp('fast', function() {
                    return $(li).remove();
                  });
                } else {
                  return li.html($.trim("Error deleting " + (li.data('squad').name) + ": <em>" + results.error + "</em>"));
                }
              });
            });
          }
        }
        loading_pane.fadeOut('fast');
        return list_ul.fadeIn('fast');
      };
    })(this));
  };

  SquadBuilderBackend.prototype.authenticate = function(cb) {
    var old_auth_state;
    if (cb == null) {
      cb = $.noop;
    }
    $(this.auth_status.find('.payload')).text('Checking auth status...');
    this.auth_status.show();
    old_auth_state = this.authenticated;
    return $.ajax({
      url: "http://localhost/",
      success: (function(_this) {
        return function(data) {
          return _this.authenticated = false;
        };
      })(this)
    }, this.maybeAuthenticationChanged(old_auth_state, cb), {
      error: (function(_this) {
        return function(jqXHR, textStatus, errorThrown) {
          _this.authenticated = false;
          return _this.maybeAuthenticationChanged(old_auth_state, cb);
        };
      })(this)
    });
  };

  SquadBuilderBackend.prototype.maybeAuthenticationChanged = function(old_auth_state, cb) {
    if (old_auth_state !== this.authenticated) {
      $(window).trigger('xwing-backend:authenticationChanged', [this.authenticated, this]);
    }
    this.oauth_window = null;
    this.auth_status.hide();
    cb(this.authenticated);
    return this.authenticated;
  };

  SquadBuilderBackend.prototype.login = function() {
    if (this.ui_ready) {
      return this.login_modal.modal('show');
    }
  };

  SquadBuilderBackend.prototype.logout = function(cb) {
    if (cb == null) {
      cb = $.noop;
    }
    $(this.auth_status.find('.payload')).text('Logging out...');
    this.auth_status.show();
    return $.get("" + this.server + "/auth/logout", (function(_this) {
      return function(data, textStatus, jqXHR) {
        _this.authenticated = false;
        $(window).trigger('xwing-backend:authenticationChanged', [_this.authenticated, _this]);
        _this.auth_status.hide();
        return cb();
      };
    })(this));
  };

  SquadBuilderBackend.prototype.showSaveAsModal = function(builder) {
    this.save_as_modal.data('builder', builder);
    this.save_as_input.val(builder.current_squad.name);
    this.save_as_save_button.addClass('disabled');
    this.nameCheck();
    return this.save_as_modal.modal('show');
  };

  SquadBuilderBackend.prototype.showDeleteModal = function(builder) {
    this.delete_modal.data('builder', builder);
    this.delete_name_container.text(builder.current_squad.name);
    return this.delete_modal.modal('show');
  };

  SquadBuilderBackend.prototype.nameCheck = function() {
    var name;
    window.clearInterval(this.save_as_modal.data('timer'));
    name = $.trim(this.save_as_input.val());
    if (name.length === 0) {
      this.name_availability_container.text('');
      return this.name_availability_container.append($.trim("<i class=\"fa fa-thumbs-down\"> A name is required"));
    } else {
      return $.post("" + this.server + "/squads/namecheck", {
        name: name
      }, (function(_this) {
        return function(data) {
          _this.name_availability_container.text('');
          if (data.available) {
            _this.name_availability_container.append($.trim("<i class=\"fa fa-thumbs-up\"> Name is available"));
            return _this.save_as_save_button.removeClass('disabled');
          } else {
            _this.name_availability_container.append($.trim("<i class=\"fa fa-thumbs-down\"> You already have a squad with that name"));
            return _this.save_as_save_button.addClass('disabled');
          }
        };
      })(this));
    }
  };

  SquadBuilderBackend.prototype.warnUnsaved = function(builder, action) {
    this.unsaved_modal.data('builder', builder);
    this.unsaved_modal.data('callback', action);
    return this.unsaved_modal.modal('show');
  };

  SquadBuilderBackend.prototype.setupUI = function() {
    var oauth_explanation;
    this.auth_status.addClass('disabled');
    this.auth_status.click((function(_this) {
      return function(e) {
        return false;
      };
    })(this));
    this.login_modal = $(document.createElement('DIV'));
    this.login_modal.addClass('modal hide fade hidden-print');
    $(document.body).append(this.login_modal);
    this.login_modal.append($.trim("<div class=\"modal-header\">\n    <button type=\"button\" class=\"close\" data-dismiss=\"modal\" aria-hidden=\"true\">&times;</button>\n    <h3>Log in with OAuth</h3>\n</div>\n<div class=\"modal-body\">\n    <p>\n        Select one of the OAuth providers below to log in and start saving squads.\n        <a class=\"login-help\" href=\"#\">What's this?</a>\n    </p>\n    <div class=\"well well-small oauth-explanation\">\n        <p>\n            <a href=\"http://en.wikipedia.org/wiki/OAuth\" target=\"_blank\">OAuth</a> is an authorization system which lets you prove your identity at a web site without having to create a new account.  Instead, you tell some provider with whom you already have an account (e.g. Google or Facebook) to prove to this web site that you say who you are.  That way, the next time you visit, this site remembers that you're that user from Google.\n        </p>\n        <p>\n            The best part about this is that you don't have to come up with a new username and password to remember.  And don't worry, I'm not collecting any data from the providers about you.  I've tried to set the scope of data to be as small as possible, but some places send a bunch of data at minimum.  I throw it away.  All I look at is a unique identifier (usually some giant number).\n        </p>\n        <p>\n            For more information, check out this <a href=\"http://hueniverse.com/oauth/guide/intro/\" target=\"_blank\">introduction to OAuth</a>.\n        </p>\n        <button class=\"btn\">Got it!</button>\n    </div>\n    <ul class=\"login-providers inline\"></ul>\n    <p>\n        This will open a new window to let you authenticate with the chosen provider.  You may have to allow pop ups for this site.  (Sorry.)\n    </p>\n    <p class=\"login-in-progress\">\n        <em>OAuth login is in progress.  Please finish authorization at the specified provider using the window that was just created.</em>\n    </p>\n</div>\n<div class=\"modal-footer\">\n    <button class=\"btn\" data-dismiss=\"modal\" aria-hidden=\"true\">Close</button>\n</div>"));
    oauth_explanation = $(this.login_modal.find('.oauth-explanation'));
    oauth_explanation.hide();
    this.login_modal.find('.login-in-progress').hide();
    this.login_modal.find('a.login-help').click((function(_this) {
      return function(e) {
        e.preventDefault();
        if (!oauth_explanation.is(':visible')) {
          return oauth_explanation.slideDown('fast');
        }
      };
    })(this));
    oauth_explanation.find('button').click((function(_this) {
      return function(e) {
        e.preventDefault();
        return oauth_explanation.slideUp('fast');
      };
    })(this));
    $.get("" + this.server + "/methods", (function(_this) {
      return function(data, textStatus, jqXHR) {
        var a, li, method, methods_ul, _i, _len, _ref;
        methods_ul = $(_this.login_modal.find('ul.login-providers'));
        _ref = data.methods;
        for (_i = 0, _len = _ref.length; _i < _len; _i++) {
          method = _ref[_i];
          a = $(document.createElement('A'));
          a.addClass('btn btn-inverse');
          a.data('url', "" + _this.server + "/auth/" + method);
          a.append("<i class=\"" + _this.method_metadata[method].icon + "\"></i>&nbsp;" + _this.method_metadata[method].text);
          a.click(function(e) {
            e.preventDefault();
            methods_ul.slideUp('fast');
            _this.login_modal.find('.login-in-progress').slideDown('fast');
            return _this.oauth_window = window.open($(e.target).data('url'), "xwing_login");
          });
          li = $(document.createElement('LI'));
          li.append(a);
          methods_ul.append(li);
        }
        return _this.ui_ready = true;
      };
    })(this));
    this.squad_list_modal = $(document.createElement('DIV'));
    this.squad_list_modal.addClass('modal hide fade hidden-print squad-list');
    $(document.body).append(this.squad_list_modal);
    this.squad_list_modal.append($.trim("<div class=\"modal-header\">\n    <button type=\"button\" class=\"close\" data-dismiss=\"modal\" aria-hidden=\"true\">&times;</button>\n    <h3 class=\"squad-list-header-placeholder hidden-phone hidden-tablet\"></h3>\n    <h4 class=\"squad-list-header-placeholder hidden-desktop\"></h4>\n</div>\n<div class=\"modal-body\">\n    <ul class=\"squad-list\"></ul>\n    <p class=\"pagination-centered squad-list-loading\">\n        <i class=\"fa fa-spinner fa-spin fa-3x\"></i>\n        <br />\n        Fetching squads...\n    </p>\n</div>\n<div class=\"modal-footer\">\n    <div class=\"btn-group squad-display-mode\">\n        <button class=\"btn btn-inverse show-all-squads\">All</button>\n        <button class=\"btn show-standard-squads\">Standard</button>\n        <button class=\"btn show-epic-squads\">Epic</button>\n        <button class=\"btn show-team-epic-squads\">Team<span class=\"hidden-phone\"> Epic</span></button>\n    </div>\n    <button class=\"btn\" data-dismiss=\"modal\" aria-hidden=\"true\">Close</button>\n</div>"));
    this.squad_list_modal.find('ul.squad-list').hide();
    this.show_all_squads_button = $(this.squad_list_modal.find('.show-all-squads'));
    this.show_all_squads_button.click((function(_this) {
      return function(e) {
        if (_this.squad_display_mode !== 'all') {
          _this.squad_display_mode = 'all';
          _this.squad_list_modal.find('.squad-display-mode .btn').removeClass('btn-inverse');
          _this.show_all_squads_button.addClass('btn-inverse');
          return _this.squad_list_modal.find('.squad-list li').show();
        }
      };
    })(this));
    this.show_standard_squads_button = $(this.squad_list_modal.find('.show-standard-squads'));
    this.show_standard_squads_button.click((function(_this) {
      return function(e) {
        if (_this.squad_display_mode !== 'standard') {
          _this.squad_display_mode = 'standard';
          _this.squad_list_modal.find('.squad-display-mode .btn').removeClass('btn-inverse');
          _this.show_standard_squads_button.addClass('btn-inverse');
          return _this.squad_list_modal.find('.squad-list li').each(function(idx, elem) {
            return $(elem).toggle(($(elem).data().squad.serialized.search(/v\d+!e/) === -1) && ($(elem).data().squad.serialized.search(/v\d+!t/) === -1));
          });
        }
      };
    })(this));
    this.show_epic_squads_button = $(this.squad_list_modal.find('.show-epic-squads'));
    this.show_epic_squads_button.click((function(_this) {
      return function(e) {
        if (_this.squad_display_mode !== 'epic') {
          _this.squad_display_mode = 'epic';
          _this.squad_list_modal.find('.squad-display-mode .btn').removeClass('btn-inverse');
          _this.show_epic_squads_button.addClass('btn-inverse');
          return _this.squad_list_modal.find('.squad-list li').each(function(idx, elem) {
            return $(elem).toggle($(elem).data().squad.serialized.search(/v\d+!e/) !== -1);
          });
        }
      };
    })(this));
    this.show_team_epic_squads_button = $(this.squad_list_modal.find('.show-team-epic-squads'));
    this.show_team_epic_squads_button.click((function(_this) {
      return function(e) {
        if (_this.squad_display_mode !== 'team-epic') {
          _this.squad_display_mode = 'team-epic';
          _this.squad_list_modal.find('.squad-display-mode .btn').removeClass('btn-inverse');
          _this.show_team_epic_squads_button.addClass('btn-inverse');
          return _this.squad_list_modal.find('.squad-list li').each(function(idx, elem) {
            return $(elem).toggle($(elem).data().squad.serialized.search(/v\d+!t/) !== -1);
          });
        }
      };
    })(this));
    this.save_as_modal = $(document.createElement('DIV'));
    this.save_as_modal.addClass('modal hide fade hidden-print');
    $(document.body).append(this.save_as_modal);
    this.save_as_modal.append($.trim("<div class=\"modal-header\">\n    <button type=\"button\" class=\"close\" data-dismiss=\"modal\" aria-hidden=\"true\">&times;</button>\n    <h3>Save Squad As...</h3>\n</div>\n<div class=\"modal-body\">\n    <label for=\"xw-be-squad-save-as\">\n        New Squad Name\n        <input id=\"xw-be-squad-save-as\"></input>\n    </label>\n    <span class=\"name-availability\"></span>\n</div>\n<div class=\"modal-footer\">\n    <button class=\"btn btn-primary save\" aria-hidden=\"true\">Save</button>\n    <button class=\"btn\" data-dismiss=\"modal\" aria-hidden=\"true\">Close</button>\n</div>"));
    this.save_as_modal.on('shown', (function(_this) {
      return function() {
        return window.setTimeout(function() {
          _this.save_as_input.focus();
          return _this.save_as_input.select();
        }, 100);
      };
    })(this));
    this.save_as_save_button = this.save_as_modal.find('button.save');
    this.save_as_save_button.click((function(_this) {
      return function(e) {
        var additional_data, builder, new_name, timer;
        e.preventDefault();
        if (!_this.save_as_save_button.hasClass('disabled')) {
          timer = _this.save_as_modal.data('timer');
          if (timer != null) {
            window.clearInterval(timer);
          }
          _this.save_as_modal.modal('hide');
          builder = _this.save_as_modal.data('builder');
          additional_data = {
            points: builder.total_points,
            description: builder.describeSquad(),
            cards: builder.listCards(),
            notes: builder.getNotes(),
            obstacles: builder.getObstacles()
          };
          builder.backend_save_list_as_button.addClass('disabled');
          builder.backend_status.html($.trim("<i class=\"fa fa-refresh fa-spin\"></i>&nbsp;Saving squad..."));
          builder.backend_status.show();
          new_name = $.trim(_this.save_as_input.val());
          return _this.save(builder.serialize(), null, new_name, builder.faction, additional_data, function(results) {
            if (results.success) {
              builder.current_squad.id = results.id;
              builder.current_squad.name = new_name;
              builder.current_squad.dirty = false;
              builder.container.trigger('xwing-backend:squadDirtinessChanged');
              builder.container.trigger('xwing-backend:squadNameChanged');
              builder.backend_status.html($.trim("<i class=\"fa fa-check\"></i>&nbsp;New squad saved successfully."));
            } else {
              builder.backend_status.html($.trim("<i class=\"fa fa-exclamation-circle\"></i>&nbsp;" + results.error));
            }
            return builder.backend_save_list_as_button.removeClass('disabled');
          });
        }
      };
    })(this));
    this.save_as_input = $(this.save_as_modal.find('input'));
    this.save_as_input.keypress((function(_this) {
      return function(e) {
        var timer;
        if (e.which === 13) {
          _this.save_as_save_button.click();
          return false;
        } else {
          _this.name_availability_container.text('');
          _this.name_availability_container.append($.trim("<i class=\"fa fa-spin fa-spinner\"></i> Checking name availability..."));
          timer = _this.save_as_modal.data('timer');
          if (timer != null) {
            window.clearInterval(timer);
          }
          return _this.save_as_modal.data('timer', window.setInterval(_this.nameCheck, 500));
        }
      };
    })(this));
    this.name_availability_container = $(this.save_as_modal.find('.name-availability'));
    this.delete_modal = $(document.createElement('DIV'));
    this.delete_modal.addClass('modal hide fade hidden-print');
    $(document.body).append(this.delete_modal);
    this.delete_modal.append($.trim("<div class=\"modal-header\">\n    <button type=\"button\" class=\"close\" data-dismiss=\"modal\" aria-hidden=\"true\">&times;</button>\n    <h3>Really Delete <span class=\"squad-name-placeholder\"></span>?</h3>\n</div>\n<div class=\"modal-body\">\n    <p>Are you sure you want to delete this squad?</p>\n</div>\n<div class=\"modal-footer\">\n    <button class=\"btn btn-danger delete\" aria-hidden=\"true\">Yes, Delete <i class=\"squad-name-placeholder\"></i></button>\n    <button class=\"btn\" data-dismiss=\"modal\" aria-hidden=\"true\">Never Mind</button>\n</div>"));
    this.delete_name_container = $(this.delete_modal.find('.squad-name-placeholder'));
    this.delete_button = $(this.delete_modal.find('button.delete'));
    this.delete_button.click((function(_this) {
      return function(e) {
        var builder;
        e.preventDefault();
        builder = _this.delete_modal.data('builder');
        builder.backend_status.html($.trim("<i class=\"fa fa-refresh fa-spin\"></i>&nbsp;Deleting squad..."));
        builder.backend_status.show();
        builder.backend_delete_list_button.addClass('disabled');
        _this.delete_modal.modal('hide');
        return _this["delete"](builder.current_squad.id, function(results) {
          if (results.success) {
            builder.resetCurrentSquad();
            builder.current_squad.dirty = true;
            builder.container.trigger('xwing-backend:squadDirtinessChanged');
            return builder.backend_status.html($.trim("<i class=\"fa fa-check\"></i>&nbsp;Squad deleted."));
          } else {
            builder.backend_status.html($.trim("<i class=\"fa fa-exclamation-circle\"></i>&nbsp;" + results.error));
            return builder.backend_delete_list_button.removeClass('disabled');
          }
        });
      };
    })(this));
    this.unsaved_modal = $(document.createElement('DIV'));
    this.unsaved_modal.addClass('modal hide fade hidden-print');
    $(document.body).append(this.unsaved_modal);
    this.unsaved_modal.append($.trim("<div class=\"modal-header\">\n    <button type=\"button\" class=\"close\" data-dismiss=\"modal\" aria-hidden=\"true\">&times;</button>\n    <h3>Unsaved Changes</h3>\n</div>\n<div class=\"modal-body\">\n    <p>You have not saved changes to this squad.  Do you want to go back and save?</p>\n</div>\n<div class=\"modal-footer\">\n    <button class=\"btn btn-primary\" aria-hidden=\"true\" data-dismiss=\"modal\">Go Back</button>\n    <button class=\"btn btn-danger discard\" aria-hidden=\"true\">Discard Changes</button>\n</div>"));
    this.unsaved_discard_button = $(this.unsaved_modal.find('button.discard'));
    return this.unsaved_discard_button.click((function(_this) {
      return function(e) {
        e.preventDefault();
        _this.unsaved_modal.data('builder').current_squad.dirty = false;
        _this.unsaved_modal.data('callback')();
        return _this.unsaved_modal.modal('hide');
      };
    })(this));
  };

  SquadBuilderBackend.prototype.setupHandlers = function() {
    $(window).on('xwing-backend:authenticationChanged', (function(_this) {
      return function(e, authenticated, backend) {
        _this.updateAuthenticationVisibility();
        if (authenticated) {
          return _this.loadCollection();
        }
      };
    })(this));
    this.login_logout_button.click((function(_this) {
      return function(e) {
        e.preventDefault();
        if (_this.authenticated) {
          return _this.logout();
        } else {
          return _this.login();
        }
      };
    })(this));
    return $(window).on('message', (function(_this) {
      return function(e) {
        var ev, _ref, _ref1;
        ev = e.originalEvent;
        if (ev.origin === _this.server) {
          switch ((_ref = ev.data) != null ? _ref.command : void 0) {
            case 'auth_successful':
              _this.authenticate();
              _this.login_modal.modal('hide');
              _this.login_modal.find('.login-in-progress').hide();
              _this.login_modal.find('ul.login-providers').show();
              return ev.source.close();
            default:
              return console.log("Unexpected command " + ((_ref1 = ev.data) != null ? _ref1.command : void 0));
          }
        } else {
          console.log("Message received from unapproved origin " + ev.origin);
          return window.last_ev = e;
        }
      };
    })(this)).on('xwing-collection:changed', (function(_this) {
      return function(e, collection) {
        if (_this.collection_save_timer != null) {
          clearTimeout(_this.collection_save_timer);
        }
        return _this.collection_save_timer = setTimeout(function() {
          return _this.saveCollection(collection, function(res) {
            if (res) {
              return $(window).trigger('xwing-collection:saved', collection);
            }
          });
        }, 1000);
      };
    })(this));
  };

  SquadBuilderBackend.prototype.getSettings = function(cb) {
    if (cb == null) {
      cb = $.noop;
    }
    return $.get("" + this.server + "/settings").done((function(_this) {
      return function(data, textStatus, jqXHR) {
        return cb(data.settings);
      };
    })(this));
  };

  SquadBuilderBackend.prototype.set = function(setting, value, cb) {
    var post_args;
    if (cb == null) {
      cb = $.noop;
    }
    post_args = {
      "_method": "PUT"
    };
    post_args[setting] = value;
    return $.post("" + this.server + "/settings", post_args).done((function(_this) {
      return function(data, textStatus, jqXHR) {
        return cb(data.set);
      };
    })(this));
  };

  SquadBuilderBackend.prototype.deleteSetting = function(setting, cb) {
    if (cb == null) {
      cb = $.noop;
    }
    return $.post("" + this.server + "/settings/" + setting, {
      "_method": "DELETE"
    }).done((function(_this) {
      return function(data, textStatus, jqXHR) {
        return cb(data.deleted);
      };
    })(this));
  };

  SquadBuilderBackend.prototype.getHeaders = function(cb) {
    if (cb == null) {
      cb = $.noop;
    }
    return $.get("" + this.server + "/headers").done((function(_this) {
      return function(data, textStatus, jqXHR) {
        return cb(data.headers);
      };
    })(this));
  };

  SquadBuilderBackend.prototype.getLanguagePreference = function(settings, cb) {
    var headers, language_code, language_range, language_tag, quality, ___iced_passed_deferral, __iced_deferrals, __iced_k;
    __iced_k = __iced_k_noop;
    ___iced_passed_deferral = iced.findDeferral(arguments);
    if (cb == null) {
      cb = $.noop;
    }
    if ((settings != null ? settings.language : void 0) != null) {
      return __iced_k(cb(settings.language));
    } else {
      (function(_this) {
        return (function(__iced_k) {
          __iced_deferrals = new iced.Deferrals(__iced_k, {
            parent: ___iced_passed_deferral,
            funcname: "SquadBuilderBackend.getLanguagePreference"
          });
          _this.getHeaders(__iced_deferrals.defer({
            assign_fn: (function() {
              return function() {
                return headers = arguments[0];
              };
            })(),
            lineno: 642
          }));
          __iced_deferrals._fulfill();
        });
      })(this)((function(_this) {
        return function() {
          var _i, _len, _ref, _ref1, _ref2;
          if ((typeof headers !== "undefined" && headers !== null ? headers.HTTP_ACCEPT_LANGUAGE : void 0) != null) {
            _ref = headers.HTTP_ACCEPT_LANGUAGE.split(',');
            for (_i = 0, _len = _ref.length; _i < _len; _i++) {
              language_range = _ref[_i];
              _ref1 = language_range.split(';'), language_tag = _ref1[0], quality = _ref1[1];
              if (language_tag === '*') {
                cb('English');
              } else {
                language_code = language_tag.split('-')[0];
                cb((_ref2 = exportObj.codeToLanguage[language_code]) != null ? _ref2 : 'English');
              }
              break;
            }
          } else {
            cb('English');
          }
          return __iced_k();
        };
      })(this));
    }
  };

  SquadBuilderBackend.prototype.saveCollection = function(collection, cb) {
    var post_args;
    if (cb == null) {
      cb = $.noop;
    }
    post_args = {
      expansions: collection.expansions,
      singletons: collection.singletons
    };
    return $.post("" + this.server + "/collection", post_args).done(function(data, textStatus, jqXHR) {
      return cb(data.success);
    });
  };

  SquadBuilderBackend.prototype.loadCollection = function() {
    return $.get("" + this.server + "/collection").done(function(data, textStatus, jqXHR) {
      var collection;
      collection = data.collection;
      return new exportObj.Collection({
        expansions: collection.expansions,
        singletons: collection.singletons
      });
    });
  };

  return SquadBuilderBackend;

})();


/*
    X-Wing Card Browser
    Geordan Rosario <geordan@gmail.com>
    https://github.com/geordanr/xwing
 */

exportObj = typeof exports !== "undefined" && exports !== null ? exports : this;

TYPES = ['pilots', 'upgrades', 'modifications', 'titles'];

byName = function(a, b) {
  var a_name, b_name;
  a_name = a.name.toLowerCase().replace(/[^a-zA-Z0-9]/g, '');
  b_name = b.name.toLowerCase().replace(/[^a-zA-Z0-9]/g, '');
  if (a_name < b_name) {
    return -1;
  } else if (b_name < a_name) {
    return 1;
  } else {
    return 0;
  }
};

byPoints = function(a, b) {
  if (a.data.points < b.data.points) {
    return -1;
  } else if (b.data.points < a.data.points) {
    return 1;
  } else {
    return byName(a, b);
  }
};

String.prototype.capitalize = function() {
  return this.charAt(0).toUpperCase() + this.slice(1);
};

exportObj.CardBrowser = (function() {
  function CardBrowser(args) {
    this.container = $(args.container);
    this.currently_selected = null;
    this.language = 'English';
    this.prepareData();
    this.setupUI();
    this.setupHandlers();
    this.sort_selector.change();
  }

  CardBrowser.prototype.setupUI = function() {
    this.container.append($.trim("<div class=\"container-fluid xwing-card-browser\">\n    <div class=\"row-fluid\">\n        <div class=\"span12\">\n            <span class=\"translate sort-cards-by\">Sort cards by</span>: <select class=\"sort-by\">\n                <option value=\"name\">Name</option>\n                <option value=\"source\">Source</option>\n                <option value=\"type-by-points\">Type (by Points)</option>\n                <option value=\"type-by-name\" selected=\"1\">Type (by Name)</option>\n            </select>\n        </div>\n    </div>\n    <div class=\"row-fluid\">\n        <div class=\"span4 card-selector-container\">\n\n        </div>\n        <div class=\"span8\">\n            <div class=\"well card-viewer-placeholder info-well\">\n                <p class=\"translate select-a-card\">Select a card from the list at the left.</p>\n            </div>\n            <div class=\"well card-viewer-container info-well\">\n                <span class=\"info-name\"></span>\n                <br />\n                <span class=\"info-type\"></span>\n                <br />\n                <span class=\"info-sources\"></span>\n                <table>\n                    <tbody>\n                        <tr class=\"info-skill\">\n                            <td class=\"info-header\">Skill</td>\n                            <td class=\"info-data info-skill\"></td>\n                        </tr>\n                        <tr class=\"info-energy\">\n                            <td class=\"info-header\"><i class=\"xwing-miniatures-font xwing-miniatures-font-energy\"></i></td>\n                            <td class=\"info-data info-energy\"></td>\n                        </tr>\n                        <tr class=\"info-attack\">\n                            <td class=\"info-header\"><i class=\"xwing-miniatures-font xwing-miniatures-font-attack\"></i></td>\n                            <td class=\"info-data info-attack\"></td>\n                        </tr>\n                        <tr class=\"info-range\">\n                            <td class=\"info-header\">Range</td>\n                            <td class=\"info-data info-range\"></td>\n                        </tr>\n                        <tr class=\"info-agility\">\n                            <td class=\"info-header\"><i class=\"xwing-miniatures-font xwing-miniatures-font-agility\"></i></td>\n                            <td class=\"info-data info-agility\"></td>\n                        </tr>\n                        <tr class=\"info-hull\">\n                            <td class=\"info-header\"><i class=\"xwing-miniatures-font xwing-miniatures-font-hull\"></i></td>\n                            <td class=\"info-data info-hull\"></td>\n                        </tr>\n                        <tr class=\"info-shields\">\n                            <td class=\"info-header\"><i class=\"xwing-miniatures-font xwing-miniatures-font-shield\"></i></td>\n                            <td class=\"info-data info-shields\"></td>\n                        </tr>\n                        <tr class=\"info-actions\">\n                            <td class=\"info-header\">Actions</td>\n                            <td class=\"info-data\"></td>\n                        </tr>\n                        <tr class=\"info-upgrades\">\n                            <td class=\"info-header\">Upgrades</td>\n                            <td class=\"info-data\"></td>\n                        </tr>\n                    </tbody>\n                </table>\n                <p class=\"info-text\" />\n            </div>\n        </div>\n    </div>\n</div>"));
    this.card_selector_container = $(this.container.find('.xwing-card-browser .card-selector-container'));
    this.card_viewer_container = $(this.container.find('.xwing-card-browser .card-viewer-container'));
    this.card_viewer_container.hide();
    this.card_viewer_placeholder = $(this.container.find('.xwing-card-browser .card-viewer-placeholder'));
    this.sort_selector = $(this.container.find('select.sort-by'));
    return this.sort_selector.select2({
      minimumResultsForSearch: -1
    });
  };

  CardBrowser.prototype.setupHandlers = function() {
    this.sort_selector.change((function(_this) {
      return function(e) {
        return _this.renderList(_this.sort_selector.val());
      };
    })(this));
    return $(window).on('xwing:afterLanguageLoad', (function(_this) {
      return function(e, language, cb) {
        if (cb == null) {
          cb = $.noop;
        }
        _this.language = language;
        _this.prepareData();
        return _this.renderList(_this.sort_selector.val());
      };
    })(this));
  };

  CardBrowser.prototype.prepareData = function() {
    var card, card_data, card_name, sorted_sources, sorted_types, source, type, upgrade_text, _i, _j, _k, _l, _len, _len1, _len2, _len3, _len4, _len5, _m, _n, _ref, _ref1, _ref2, _results;
    this.all_cards = [];
    for (_i = 0, _len = TYPES.length; _i < _len; _i++) {
      type = TYPES[_i];
      if (type === 'upgrades') {
        this.all_cards = this.all_cards.concat((function() {
          var _ref, _results;
          _ref = exportObj[type];
          _results = [];
          for (card_name in _ref) {
            card_data = _ref[card_name];
            _results.push({
              name: card_data.name,
              type: exportObj.translate(this.language, 'ui', 'upgradeHeader', card_data.slot),
              data: card_data,
              orig_type: card_data.slot
            });
          }
          return _results;
        }).call(this));
      } else {
        this.all_cards = this.all_cards.concat((function() {
          var _ref, _results;
          _ref = exportObj[type];
          _results = [];
          for (card_name in _ref) {
            card_data = _ref[card_name];
            _results.push({
              name: card_data.name,
              type: exportObj.translate(this.language, 'singular', type),
              data: card_data,
              orig_type: exportObj.translate('English', 'singular', type)
            });
          }
          return _results;
        }).call(this));
      }
    }
    this.types = (function() {
      var _j, _len1, _ref, _results;
      _ref = ['Pilot', 'Modification', 'Title'];
      _results = [];
      for (_j = 0, _len1 = _ref.length; _j < _len1; _j++) {
        type = _ref[_j];
        _results.push(exportObj.translate(this.language, 'types', type));
      }
      return _results;
    }).call(this);
    _ref = exportObj.upgrades;
    for (card_name in _ref) {
      card_data = _ref[card_name];
      upgrade_text = exportObj.translate(this.language, 'ui', 'upgradeHeader', card_data.slot);
      if (__indexOf.call(this.types, upgrade_text) < 0) {
        this.types.push(upgrade_text);
      }
    }
    this.all_cards.sort(byName);
    this.sources = [];
    _ref1 = this.all_cards;
    for (_j = 0, _len1 = _ref1.length; _j < _len1; _j++) {
      card = _ref1[_j];
      _ref2 = card.data.sources;
      for (_k = 0, _len2 = _ref2.length; _k < _len2; _k++) {
        source = _ref2[_k];
        if (__indexOf.call(this.sources, source) < 0) {
          this.sources.push(source);
        }
      }
    }
    sorted_types = this.types.sort();
    sorted_sources = this.sources.sort();
    this.cards_by_type_name = {};
    for (_l = 0, _len3 = sorted_types.length; _l < _len3; _l++) {
      type = sorted_types[_l];
      this.cards_by_type_name[type] = ((function() {
        var _len4, _m, _ref3, _results;
        _ref3 = this.all_cards;
        _results = [];
        for (_m = 0, _len4 = _ref3.length; _m < _len4; _m++) {
          card = _ref3[_m];
          if (card.type === type) {
            _results.push(card);
          }
        }
        return _results;
      }).call(this)).sort(byName);
    }
    this.cards_by_type_points = {};
    for (_m = 0, _len4 = sorted_types.length; _m < _len4; _m++) {
      type = sorted_types[_m];
      this.cards_by_type_points[type] = ((function() {
        var _len5, _n, _ref3, _results;
        _ref3 = this.all_cards;
        _results = [];
        for (_n = 0, _len5 = _ref3.length; _n < _len5; _n++) {
          card = _ref3[_n];
          if (card.type === type) {
            _results.push(card);
          }
        }
        return _results;
      }).call(this)).sort(byPoints);
    }
    this.cards_by_source = {};
    _results = [];
    for (_n = 0, _len5 = sorted_sources.length; _n < _len5; _n++) {
      source = sorted_sources[_n];
      _results.push(this.cards_by_source[source] = ((function() {
        var _len6, _o, _ref3, _results1;
        _ref3 = this.all_cards;
        _results1 = [];
        for (_o = 0, _len6 = _ref3.length; _o < _len6; _o++) {
          card = _ref3[_o];
          if (__indexOf.call(card.data.sources, source) >= 0) {
            _results1.push(card);
          }
        }
        return _results1;
      }).call(this)).sort(byName));
    }
    return _results;
  };

  CardBrowser.prototype.renderList = function(sort_by) {
    var card, optgroup, source, type, _i, _j, _k, _l, _len, _len1, _len2, _len3, _len4, _len5, _len6, _m, _n, _o, _ref, _ref1, _ref2, _ref3, _ref4, _ref5, _ref6;
    if (sort_by == null) {
      sort_by = 'name';
    }
    if (this.card_selector != null) {
      this.card_selector.remove();
    }
    this.card_selector = $(document.createElement('SELECT'));
    this.card_selector.addClass('card-selector');
    this.card_selector.attr('size', 25);
    this.card_selector_container.append(this.card_selector);
    switch (sort_by) {
      case 'type-by-name':
        _ref = this.types;
        for (_i = 0, _len = _ref.length; _i < _len; _i++) {
          type = _ref[_i];
          optgroup = $(document.createElement('OPTGROUP'));
          optgroup.attr('label', type);
          this.card_selector.append(optgroup);
          _ref1 = this.cards_by_type_name[type];
          for (_j = 0, _len1 = _ref1.length; _j < _len1; _j++) {
            card = _ref1[_j];
            this.addCardTo(optgroup, card);
          }
        }
        break;
      case 'type-by-points':
        _ref2 = this.types;
        for (_k = 0, _len2 = _ref2.length; _k < _len2; _k++) {
          type = _ref2[_k];
          optgroup = $(document.createElement('OPTGROUP'));
          optgroup.attr('label', type);
          this.card_selector.append(optgroup);
          _ref3 = this.cards_by_type_points[type];
          for (_l = 0, _len3 = _ref3.length; _l < _len3; _l++) {
            card = _ref3[_l];
            this.addCardTo(optgroup, card);
          }
        }
        break;
      case 'source':
        _ref4 = this.sources;
        for (_m = 0, _len4 = _ref4.length; _m < _len4; _m++) {
          source = _ref4[_m];
          optgroup = $(document.createElement('OPTGROUP'));
          optgroup.attr('label', source);
          this.card_selector.append(optgroup);
          _ref5 = this.cards_by_source[source];
          for (_n = 0, _len5 = _ref5.length; _n < _len5; _n++) {
            card = _ref5[_n];
            this.addCardTo(optgroup, card);
          }
        }
        break;
      default:
        _ref6 = this.all_cards;
        for (_o = 0, _len6 = _ref6.length; _o < _len6; _o++) {
          card = _ref6[_o];
          this.addCardTo(this.card_selector, card);
        }
    }
    return this.card_selector.change((function(_this) {
      return function(e) {
        return _this.renderCard($(_this.card_selector.find(':selected')));
      };
    })(this));
  };

  CardBrowser.prototype.renderCard = function(card) {
    var action, cls, data, name, orig_type, ship, slot, source, type, _i, _len, _ref, _ref1, _ref10, _ref11, _ref12, _ref13, _ref14, _ref2, _ref3, _ref4, _ref5, _ref6, _ref7, _ref8, _ref9;
    name = card.data('name');
    type = card.data('type');
    data = card.data('card');
    orig_type = card.data('orig_type');
    this.card_viewer_container.find('.info-name').html("" + (data.unique ? "&middot;&nbsp;" : "") + name + " (" + data.points + ")" + (data.limited != null ? " (" + (exportObj.translate(this.language, 'ui', 'limited')) + ")" : "") + (data.epic != null ? " (" + (exportObj.translate(this.language, 'ui', 'epic')) + ")" : "") + (exportObj.isReleased(data) ? "" : " (" + (exportObj.translate(this.language, 'ui', 'unreleased')) + ")"));
    this.card_viewer_container.find('p.info-text').html((_ref = data.text) != null ? _ref : '');
    this.card_viewer_container.find('.info-sources').text(((function() {
      var _i, _len, _ref1, _results;
      _ref1 = data.sources;
      _results = [];
      for (_i = 0, _len = _ref1.length; _i < _len; _i++) {
        source = _ref1[_i];
        _results.push(exportObj.translate(this.language, 'sources', source));
      }
      return _results;
    }).call(this)).sort().join(', '));
    switch (orig_type) {
      case 'Pilot':
        ship = exportObj.ships[data.ship];
        this.card_viewer_container.find('.info-type').text("" + data.ship + " Pilot (" + data.faction + ")");
        this.card_viewer_container.find('tr.info-skill td.info-data').text(data.skill);
        this.card_viewer_container.find('tr.info-skill').show();
        this.card_viewer_container.find('tr.info-attack td.info-data').text((_ref1 = (_ref2 = data.ship_override) != null ? _ref2.attack : void 0) != null ? _ref1 : ship.attack);
        this.card_viewer_container.find('tr.info-attack').toggle((((_ref3 = data.ship_override) != null ? _ref3.attack : void 0) != null) || (ship.attack != null));
        _ref4 = this.card_viewer_container.find('tr.info-attack td.info-header i.xwing-miniatures-font')[0].classList;
        for (_i = 0, _len = _ref4.length; _i < _len; _i++) {
          cls = _ref4[_i];
          if (cls.startsWith('xwing-miniatures-font-attack')) {
            this.card_viewer_container.find('tr.info-attack td.info-header i.xwing-miniatures-font').removeClass(cls);
          }
        }
        this.card_viewer_container.find('tr.info-attack td.info-header i.xwing-miniatures-font').addClass((_ref5 = ship.attack_icon) != null ? _ref5 : 'xwing-miniatures-font-attack');
        this.card_viewer_container.find('tr.info-energy td.info-data').text((_ref6 = (_ref7 = data.ship_override) != null ? _ref7.energy : void 0) != null ? _ref6 : ship.energy);
        this.card_viewer_container.find('tr.info-energy').toggle((((_ref8 = data.ship_override) != null ? _ref8.energy : void 0) != null) || (ship.energy != null));
        this.card_viewer_container.find('tr.info-range').hide();
        this.card_viewer_container.find('tr.info-agility td.info-data').text((_ref9 = (_ref10 = data.ship_override) != null ? _ref10.agility : void 0) != null ? _ref9 : ship.agility);
        this.card_viewer_container.find('tr.info-agility').show();
        this.card_viewer_container.find('tr.info-hull td.info-data').text((_ref11 = (_ref12 = data.ship_override) != null ? _ref12.hull : void 0) != null ? _ref11 : ship.hull);
        this.card_viewer_container.find('tr.info-hull').show();
        this.card_viewer_container.find('tr.info-shields td.info-data').text((_ref13 = (_ref14 = data.ship_override) != null ? _ref14.shields : void 0) != null ? _ref13 : ship.shields);
        this.card_viewer_container.find('tr.info-shields').show();
        this.card_viewer_container.find('tr.info-actions td.info-data').text(((function() {
          var _j, _len1, _ref15, _results;
          _ref15 = exportObj.ships[data.ship].actions;
          _results = [];
          for (_j = 0, _len1 = _ref15.length; _j < _len1; _j++) {
            action = _ref15[_j];
            _results.push(exportObj.translate(this.language, 'action', action));
          }
          return _results;
        }).call(this)).join(', '));
        this.card_viewer_container.find('tr.info-actions').show();
        this.card_viewer_container.find('tr.info-upgrades').show();
        this.card_viewer_container.find('tr.info-upgrades td.info-data').text(((function() {
          var _j, _len1, _ref15, _results;
          _ref15 = data.slots;
          _results = [];
          for (_j = 0, _len1 = _ref15.length; _j < _len1; _j++) {
            slot = _ref15[_j];
            _results.push(exportObj.translate(this.language, 'slot', slot));
          }
          return _results;
        }).call(this)).join(', ') || 'None');
        break;
      default:
        this.card_viewer_container.find('.info-type').text(type);
        if (data.faction != null) {
          this.card_viewer_container.find('.info-type').append(" &ndash; " + data.faction + " only");
        }
        this.card_viewer_container.find('tr.info-ship').hide();
        this.card_viewer_container.find('tr.info-skill').hide();
        if (data.energy != null) {
          this.card_viewer_container.find('tr.info-energy td.info-data').text(data.energy);
          this.card_viewer_container.find('tr.info-energy').show();
        } else {
          this.card_viewer_container.find('tr.info-energy').hide();
        }
        if (data.attack != null) {
          this.card_viewer_container.find('tr.info-attack td.info-data').text(data.attack);
          this.card_viewer_container.find('tr.info-attack').show();
        } else {
          this.card_viewer_container.find('tr.info-attack').hide();
        }
        if (data.range != null) {
          this.card_viewer_container.find('tr.info-range td.info-data').text(data.range);
          this.card_viewer_container.find('tr.info-range').show();
        } else {
          this.card_viewer_container.find('tr.info-range').hide();
        }
        this.card_viewer_container.find('tr.info-agility').hide();
        this.card_viewer_container.find('tr.info-hull').hide();
        this.card_viewer_container.find('tr.info-shields').hide();
        this.card_viewer_container.find('tr.info-actions').hide();
        this.card_viewer_container.find('tr.info-upgrades').hide();
    }
    this.card_viewer_container.show();
    return this.card_viewer_placeholder.hide();
  };

  CardBrowser.prototype.addCardTo = function(container, card) {
    var option;
    option = $(document.createElement('OPTION'));
    option.text("" + card.name + " (" + card.data.points + ")");
    option.data('name', card.name);
    option.data('type', card.type);
    option.data('card', card.data);
    option.data('orig_type', card.orig_type);
    return $(container).append(option);
  };

  return CardBrowser;

})();

exportObj = typeof exports !== "undefined" && exports !== null ? exports : this;

exportObj.unreleasedExpansions = ['Alpha-class Star Wing Expansion Pack', 'M12-L Kimogila Fighter Expansion Pack', 'Phantom II Expansion Pack', 'Resistance Bomber Expansion Pack', 'TIE Silencer Expansion Pack'];

exportObj.isReleased = function(data) {
  var source, _i, _len, _ref;
  _ref = data.sources;
  for (_i = 0, _len = _ref.length; _i < _len; _i++) {
    source = _ref[_i];
    if (__indexOf.call(exportObj.unreleasedExpansions, source) < 0) {
      return true;
    }
  }
  return false;
};

String.prototype.canonicalize = function() {
  return this.toLowerCase().replace(/[^a-z0-9]/g, '').replace(/\s+/g, '-');
};

exportObj.hugeOnly = function(ship) {
  var _ref;
  return (_ref = ship.data.huge) != null ? _ref : false;
};

exportObj.basicCardData = function() {
  return {
    ships: {
      "X-Wing": {
        name: "X-Wing",
        factions: ["Rebel Alliance"],
        attack: 3,
        agility: 2,
        hull: 3,
        shields: 2,
        actions: ["Focus", "Target Lock"],
        maneuvers: [[0, 0, 0, 0, 0, 0], [0, 2, 2, 2, 0, 0], [1, 1, 2, 1, 1, 0], [1, 1, 1, 1, 1, 0], [0, 0, 1, 0, 0, 3]]
      },
      "Y-Wing": {
        name: "Y-Wing",
        factions: ["Rebel Alliance", "Scum and Villainy"],
        attack: 2,
        agility: 1,
        hull: 5,
        shields: 3,
        actions: ["Focus", "Target Lock"],
        maneuvers: [[0, 0, 0, 0, 0, 0], [0, 1, 2, 1, 0, 0], [1, 1, 2, 1, 1, 0], [3, 1, 1, 1, 3, 0], [0, 0, 3, 0, 0, 3]]
      },
      "A-Wing": {
        name: "A-Wing",
        factions: ["Rebel Alliance"],
        attack: 2,
        agility: 3,
        hull: 2,
        shields: 2,
        actions: ["Focus", "Target Lock", "Boost", "Evade"],
        maneuvers: [[0, 0, 0, 0, 0, 0], [1, 0, 0, 0, 1, 0], [2, 2, 2, 2, 2, 0], [1, 1, 2, 1, 1, 3], [0, 0, 2, 0, 0, 0], [0, 0, 2, 0, 0, 3]]
      },
      "YT-1300": {
        name: "YT-1300",
        factions: ["Rebel Alliance", "Resistance"],
        attack: 2,
        agility: 1,
        hull: 6,
        shields: 4,
        actions: ["Focus", "Target Lock"],
        attack_icon: 'xwing-miniatures-font-attack-turret',
        maneuvers: [[0, 0, 0, 0, 0, 0], [1, 2, 2, 2, 1, 0], [1, 1, 2, 1, 1, 0], [0, 1, 1, 1, 0, 3], [0, 0, 1, 0, 0, 3]],
        large: true
      },
      "TIE Fighter": {
        name: "TIE Fighter",
        factions: ["Rebel Alliance", "Galactic Empire"],
        attack: 2,
        agility: 3,
        hull: 3,
        shields: 0,
        actions: ["Focus", "Barrel Roll", "Evade"],
        maneuvers: [[0, 0, 0, 0, 0, 0], [1, 0, 0, 0, 1, 0], [1, 2, 2, 2, 1, 0], [1, 1, 2, 1, 1, 3], [0, 0, 1, 0, 0, 3], [0, 0, 1, 0, 0, 0]]
      },
      "TIE Advanced": {
        name: "TIE Advanced",
        factions: ["Galactic Empire"],
        attack: 2,
        agility: 3,
        hull: 3,
        shields: 2,
        actions: ["Focus", "Target Lock", "Barrel Roll", "Evade"],
        maneuvers: [[0, 0, 0, 0, 0, 0], [0, 2, 0, 2, 0, 0], [1, 1, 2, 1, 1, 0], [1, 1, 2, 1, 1, 0], [0, 0, 1, 0, 0, 3], [0, 0, 1, 0, 0, 0]]
      },
      "TIE Interceptor": {
        name: "TIE Interceptor",
        factions: ["Galactic Empire"],
        attack: 3,
        agility: 3,
        hull: 3,
        shields: 0,
        actions: ["Focus", "Barrel Roll", "Boost", "Evade"],
        maneuvers: [[0, 0, 0, 0, 0, 0], [1, 0, 0, 0, 1, 0], [2, 2, 2, 2, 2, 0], [1, 1, 2, 1, 1, 3], [0, 0, 2, 0, 0, 0], [0, 0, 1, 0, 0, 3]]
      },
      "Firespray-31": {
        name: "Firespray-31",
        factions: ["Galactic Empire", "Scum and Villainy"],
        attack: 3,
        agility: 2,
        hull: 6,
        shields: 4,
        actions: ["Focus", "Target Lock", "Evade"],
        attack_icon: 'xwing-miniatures-font-attack-frontback',
        maneuvers: [[0, 0, 0, 0, 0, 0], [0, 2, 2, 2, 0, 0], [1, 1, 2, 1, 1, 0], [1, 1, 1, 1, 1, 3], [0, 0, 1, 0, 0, 3]],
        large: true
      },
      "HWK-290": {
        name: "HWK-290",
        factions: ["Rebel Alliance", "Scum and Villainy"],
        attack: 1,
        agility: 2,
        hull: 4,
        shields: 1,
        actions: ["Focus", "Target Lock"],
        maneuvers: [[0, 0, 0, 0, 0], [0, 2, 2, 2, 0], [1, 1, 2, 1, 1], [0, 3, 1, 3, 0], [0, 0, 3, 0, 0]]
      },
      "Lambda-Class Shuttle": {
        name: "Lambda-Class Shuttle",
        factions: ["Galactic Empire"],
        attack: 3,
        agility: 1,
        hull: 5,
        shields: 5,
        actions: ["Focus", "Target Lock"],
        maneuvers: [[0, 0, 3, 0, 0], [0, 2, 2, 2, 0], [3, 1, 2, 1, 3], [0, 3, 1, 3, 0]],
        large: true
      },
      "B-Wing": {
        name: "B-Wing",
        factions: ["Rebel Alliance"],
        attack: 3,
        agility: 1,
        hull: 3,
        shields: 5,
        actions: ["Focus", "Target Lock", "Barrel Roll"],
        maneuvers: [[0, 0, 0, 0, 0, 0], [3, 2, 2, 2, 3, 0], [1, 1, 2, 1, 1, 3], [0, 3, 1, 3, 0, 0], [0, 0, 3, 0, 0, 0]]
      },
      "TIE Bomber": {
        name: "TIE Bomber",
        factions: ["Galactic Empire"],
        attack: 2,
        agility: 2,
        hull: 6,
        shields: 0,
        actions: ["Focus", "Target Lock", "Barrel Roll"],
        maneuvers: [[0, 0, 0, 0, 0, 0], [0, 1, 2, 1, 0, 0], [3, 2, 2, 2, 3, 0], [1, 1, 2, 1, 1, 0], [0, 0, 1, 0, 0, 0], [0, 0, 0, 0, 0, 3]]
      },
      "GR-75 Medium Transport": {
        name: "GR-75 Medium Transport",
        factions: ["Rebel Alliance"],
        energy: 4,
        agility: 0,
        hull: 8,
        shields: 4,
        actions: ["Recover", "Reinforce", "Coordinate", "Jam"],
        huge: true,
        epic_points: 2,
        maneuvers: [[0, 0, 0, 0, 0, 0], [0, 1, 1, 1, 0, 0], [0, 1, 1, 1, 0, 0], [0, 0, 1, 0, 0, 0], [0, 0, 1, 0, 0, 0]]
      },
      "Z-95 Headhunter": {
        name: "Z-95 Headhunter",
        factions: ["Rebel Alliance", "Scum and Villainy"],
        attack: 2,
        agility: 2,
        hull: 2,
        shields: 2,
        actions: ["Focus", "Target Lock"],
        maneuvers: [[0, 0, 0, 0, 0, 0], [0, 1, 2, 1, 0, 0], [1, 2, 2, 2, 1, 0], [1, 1, 1, 1, 1, 3], [0, 0, 1, 0, 0, 0]]
      },
      "TIE Defender": {
        name: "TIE Defender",
        factions: ["Galactic Empire"],
        attack: 3,
        agility: 3,
        hull: 3,
        shields: 3,
        actions: ["Focus", "Target Lock", "Barrel Roll"],
        maneuvers: [[0, 0, 0, 0, 0, 0], [3, 1, 0, 1, 3, 0], [3, 1, 2, 1, 3, 0], [1, 1, 2, 1, 1, 0], [0, 0, 2, 0, 0, 1], [0, 0, 2, 0, 0, 0]]
      },
      "E-Wing": {
        name: "E-Wing",
        factions: ["Rebel Alliance"],
        attack: 3,
        agility: 3,
        hull: 2,
        shields: 3,
        actions: ["Focus", "Target Lock", "Barrel Roll", "Evade"],
        maneuvers: [[0, 0, 0, 0, 0, 0], [0, 1, 2, 1, 0, 0], [1, 2, 2, 2, 1, 0], [1, 1, 2, 1, 1, 3], [0, 0, 1, 0, 0, 3], [0, 0, 1, 0, 0, 0]]
      },
      "TIE Phantom": {
        name: "TIE Phantom",
        factions: ["Galactic Empire"],
        attack: 4,
        agility: 2,
        hull: 2,
        shields: 2,
        actions: ["Focus", "Barrel Roll", "Evade", "Cloak"],
        maneuvers: [[0, 0, 0, 0, 0, 0], [1, 0, 0, 0, 1, 0], [1, 2, 2, 2, 1, 0], [1, 1, 2, 1, 1, 3], [0, 0, 1, 0, 0, 3]]
      },
      "CR90 Corvette (Fore)": {
        name: "CR90 Corvette (Fore)",
        factions: ["Rebel Alliance"],
        attack: 4,
        agility: 0,
        hull: 8,
        shields: 5,
        actions: ["Coordinate", "Target Lock"],
        huge: true,
        epic_points: 1.5,
        attack_icon: 'xwing-miniatures-font-attack-turret',
        maneuvers: [[0, 0, 0, 0, 0, 0], [0, 1, 0, 1, 0, 0], [0, 1, 1, 1, 0, 0], [0, 0, 1, 0, 0, 0], [0, 0, 1, 0, 0, 0]],
        multisection: ["CR90 Corvette (Aft)".canonicalize()],
        canonical_name: "CR90 Corvette".canonicalize()
      },
      "CR90 Corvette (Aft)": {
        name: "CR90 Corvette (Aft)",
        factions: ["Rebel Alliance"],
        energy: 5,
        agility: 0,
        hull: 8,
        shields: 3,
        actions: ["Reinforce", "Recover"],
        huge: true,
        epic_points: 1.5,
        maneuvers: [[0, 0, 0, 0, 0, 0], [0, 1, 0, 1, 0, 0], [0, 1, 1, 1, 0, 0], [0, 0, 1, 0, 0, 0], [0, 0, 1, 0, 0, 0]],
        multisection: ["CR90 Corvette (Fore)".canonicalize()],
        canonical_name: "CR90 Corvette".canonicalize()
      },
      "YT-2400": {
        name: "YT-2400",
        factions: ["Rebel Alliance"],
        attack: 2,
        agility: 2,
        hull: 5,
        shields: 5,
        actions: ["Focus", "Target Lock", "Barrel Roll"],
        large: true,
        attack_icon: 'xwing-miniatures-font-attack-turret',
        maneuvers: [[0, 0, 0, 0, 0, 0], [1, 2, 2, 2, 1, 0], [1, 1, 2, 1, 1, 0], [1, 1, 1, 1, 1, 0], [0, 0, 1, 0, 0, 3]]
      },
      "VT-49 Decimator": {
        name: "VT-49 Decimator",
        factions: ["Galactic Empire"],
        attack: 3,
        agility: 0,
        hull: 12,
        shields: 4,
        actions: ["Focus", "Target Lock"],
        large: true,
        attack_icon: 'xwing-miniatures-font-attack-turret',
        maneuvers: [[0, 0, 0, 0, 0, 0], [0, 1, 1, 1, 0, 0], [1, 2, 2, 2, 1, 0], [1, 1, 2, 1, 1, 0], [0, 0, 1, 0, 0, 0]]
      },
      "StarViper": {
        name: "StarViper",
        factions: ["Scum and Villainy"],
        attack: 3,
        agility: 3,
        hull: 4,
        shields: 1,
        actions: ["Focus", "Target Lock", "Barrel Roll", "Boost"],
        maneuvers: [[0, 0, 0, 0, 0, 0, 0, 0], [1, 2, 2, 2, 1, 0, 0, 0], [1, 1, 2, 1, 1, 0, 0, 0], [0, 1, 2, 1, 0, 0, 3, 3], [0, 0, 1, 0, 0, 0, 0, 0]]
      },
      "M3-A Interceptor": {
        name: "M3-A Interceptor",
        factions: ["Scum and Villainy"],
        attack: 2,
        agility: 3,
        hull: 2,
        shields: 1,
        actions: ["Focus", "Target Lock", "Barrel Roll", "Evade"],
        maneuvers: [[0, 0, 0, 0, 0, 0], [1, 2, 0, 2, 1, 0], [1, 2, 2, 2, 1, 0], [0, 1, 2, 1, 0, 3], [0, 0, 1, 0, 0, 0], [0, 0, 0, 0, 0, 3]]
      },
      "Aggressor": {
        name: "Aggressor",
        factions: ["Scum and Villainy"],
        attack: 3,
        agility: 3,
        hull: 4,
        shields: 4,
        actions: ["Focus", "Target Lock", "Boost", "Evade"],
        large: true,
        maneuvers: [[0, 0, 0, 0, 0, 0, 0, 0], [1, 2, 2, 2, 1, 0, 0, 0], [1, 2, 2, 2, 1, 0, 0, 0], [0, 2, 2, 2, 0, 0, 3, 3], [0, 0, 0, 0, 0, 3, 0, 0]]
      },
      "Raider-class Corvette (Fore)": {
        name: "Raider-class Corvette (Fore)",
        factions: ["Galactic Empire"],
        attack: 4,
        agility: 0,
        hull: 8,
        shields: 6,
        actions: ["Recover", "Reinforce"],
        huge: true,
        epic_points: 1.5,
        maneuvers: [[0, 0, 0, 0, 0, 0], [0, 1, 1, 1, 0, 0], [0, 1, 1, 1, 0, 0], [0, 0, 1, 0, 0, 0], [0, 0, 1, 0, 0, 0]],
        multisection: ["Raider-class Corvette (Aft)".canonicalize()],
        canonical_name: "Raider-class Corvette".canonicalize()
      },
      "Raider-class Corvette (Aft)": {
        name: "Raider-class Corvette (Aft)",
        factions: ["Galactic Empire"],
        energy: 6,
        agility: 0,
        hull: 8,
        shields: 4,
        actions: ["Coordinate", "Target Lock"],
        huge: true,
        epic_points: 1.5,
        maneuvers: [[0, 0, 0, 0, 0, 0], [0, 1, 1, 1, 0, 0], [0, 1, 1, 1, 0, 0], [0, 0, 1, 0, 0, 0], [0, 0, 1, 0, 0, 0]],
        multisection: ["Raider-class Corvette (Fore)".canonicalize()],
        canonical_name: "Raider-class Corvette".canonicalize()
      },
      "YV-666": {
        name: "YV-666",
        factions: ["Scum and Villainy"],
        attack: 3,
        agility: 1,
        hull: 6,
        shields: 6,
        large: true,
        actions: ["Focus", "Target Lock"],
        attack_icon: 'xwing-miniatures-font-attack-180',
        maneuvers: [[0, 0, 3, 0, 0, 0], [0, 2, 2, 2, 0, 0], [3, 1, 2, 1, 3, 0], [1, 1, 2, 1, 1, 0], [0, 0, 1, 0, 0, 0]]
      },
      "Kihraxz Fighter": {
        name: "Kihraxz Fighter",
        factions: ["Scum and Villainy"],
        attack: 3,
        agility: 2,
        hull: 4,
        shields: 1,
        actions: ["Focus", "Target Lock"],
        maneuvers: [[0, 0, 0, 0, 0, 0], [1, 2, 0, 2, 1, 0], [1, 2, 2, 2, 1, 0], [0, 1, 1, 1, 0, 0], [0, 0, 1, 0, 0, 3], [0, 0, 0, 0, 0, 3]]
      },
      "K-Wing": {
        name: "K-Wing",
        factions: ["Rebel Alliance"],
        attack: 2,
        agility: 1,
        hull: 5,
        shields: 4,
        actions: ["Focus", "Target Lock", "SLAM"],
        attack_icon: 'xwing-miniatures-font-attack-turret',
        maneuvers: [[0, 0, 0, 0, 0, 0], [0, 2, 2, 2, 0, 0], [1, 1, 2, 1, 1, 0], [0, 1, 1, 1, 0, 0]]
      },
      "TIE Punisher": {
        name: "TIE Punisher",
        factions: ["Galactic Empire"],
        attack: 2,
        agility: 1,
        hull: 6,
        shields: 3,
        actions: ["Focus", "Target Lock", "Boost"],
        maneuvers: [[0, 0, 0, 0, 0, 0], [0, 2, 2, 2, 0, 0], [3, 1, 2, 1, 3, 0], [1, 1, 1, 1, 1, 0], [0, 0, 0, 0, 0, 3]]
      },
      "Gozanti-class Cruiser": {
        name: "Gozanti-class Cruiser",
        factions: ["Galactic Empire"],
        energy: 4,
        agility: 0,
        hull: 9,
        shields: 5,
        huge: true,
        epic_points: 2,
        actions: ["Recover", "Reinforce", "Coordinate", "Target Lock"],
        maneuvers: [[0, 0, 0, 0, 0, 0], [0, 1, 1, 1, 0, 0], [0, 1, 1, 1, 0, 0], [0, 0, 1, 0, 0, 0], [0, 0, 1, 0, 0, 0]]
      },
      "VCX-100": {
        name: "VCX-100",
        factions: ["Rebel Alliance"],
        attack: 4,
        agility: 0,
        hull: 10,
        shields: 6,
        large: true,
        actions: ["Focus", "Target Lock", "Evade"],
        maneuvers: [[0, 0, 0, 0, 0, 0], [3, 1, 2, 1, 3, 0], [1, 2, 2, 2, 1, 0], [3, 1, 1, 1, 3, 0], [0, 0, 1, 0, 0, 0], [0, 0, 0, 0, 0, 3]]
      },
      "Attack Shuttle": {
        name: "Attack Shuttle",
        factions: ["Rebel Alliance"],
        attack: 3,
        agility: 2,
        hull: 2,
        shields: 2,
        actions: ["Focus", "Barrel Roll", "Evade"],
        maneuvers: [[0, 0, 0, 0, 0, 0], [3, 2, 2, 2, 3, 0], [1, 1, 2, 1, 1, 0], [3, 1, 1, 1, 3, 0], [0, 0, 1, 0, 0, 3]]
      },
      "TIE Advanced Prototype": {
        name: "TIE Advanced Prototype",
        canonical_name: 'TIE Adv. Prototype'.canonicalize(),
        factions: ["Galactic Empire"],
        attack: 2,
        agility: 3,
        hull: 2,
        shields: 2,
        actions: ["Focus", "Target Lock", "Barrel Roll", "Boost"],
        maneuvers: [[0, 0, 0, 0, 0, 0], [2, 2, 0, 2, 2, 0], [1, 1, 2, 1, 1, 0], [1, 1, 2, 1, 1, 0], [0, 0, 2, 0, 0, 3], [0, 0, 1, 0, 0, 0]]
      },
      "G-1A Starfighter": {
        name: "G-1A Starfighter",
        factions: ["Scum and Villainy"],
        attack: 3,
        agility: 1,
        hull: 4,
        shields: 4,
        actions: ["Focus", "Target Lock", "Evade"],
        maneuvers: [[0, 0, 0, 0, 0, 0], [3, 2, 2, 2, 3, 0], [1, 1, 2, 1, 1, 0], [0, 3, 2, 3, 0, 3], [0, 0, 1, 0, 0, 3]]
      },
      "JumpMaster 5000": {
        name: "JumpMaster 5000",
        factions: ["Scum and Villainy"],
        large: true,
        attack: 2,
        agility: 2,
        hull: 5,
        shields: 4,
        actions: ["Focus", "Target Lock", "Barrel Roll"],
        attack_icon: 'xwing-miniatures-font-attack-turret',
        maneuvers: [[0, 0, 0, 0, 0, 0, 0, 0], [2, 2, 2, 1, 1, 0, 0, 0], [2, 2, 2, 1, 1, 0, 1, 3], [0, 1, 1, 1, 0, 0, 0, 0], [0, 0, 1, 0, 0, 3, 0, 0]]
      },
      "T-70 X-Wing": {
        name: "T-70 X-Wing",
        factions: ["Resistance"],
        attack: 3,
        agility: 2,
        hull: 3,
        shields: 3,
        actions: ["Focus", "Target Lock", "Boost"],
        maneuvers: [[0, 0, 0, 0, 0, 0, 0, 0, 0, 0], [0, 2, 2, 2, 0, 0, 0, 0, 0, 0], [1, 1, 2, 1, 1, 0, 0, 0, 0, 0], [1, 1, 2, 1, 1, 0, 0, 0, 3, 3], [0, 0, 1, 0, 0, 3, 0, 0, 0, 0]]
      },
      "TIE/fo Fighter": {
        name: "TIE/fo Fighter",
        factions: ["First Order"],
        attack: 2,
        agility: 3,
        hull: 3,
        shields: 1,
        actions: ["Focus", "Target Lock", "Barrel Roll", "Evade"],
        maneuvers: [[0, 0, 0, 0, 0, 0, 0, 0], [1, 0, 0, 0, 1, 0, 0, 0], [2, 2, 2, 2, 2, 0, 3, 3], [1, 1, 2, 1, 1, 0, 0, 0], [0, 0, 1, 0, 0, 3, 0, 0], [0, 0, 1, 0, 0, 0, 0, 0]]
      },
      'ARC-170': {
        name: 'ARC-170',
        factions: ["Rebel Alliance"],
        attack: 2,
        agility: 1,
        hull: 6,
        shields: 3,
        actions: ["Focus", "Target Lock"],
        attack_icon: 'xwing-miniatures-font-attack-frontback',
        maneuvers: [[0, 0, 0, 0, 0, 0], [0, 2, 2, 2, 0, 0], [1, 2, 2, 2, 1, 0], [3, 1, 1, 1, 3, 0], [0, 0, 3, 0, 0, 3]]
      },
      'TIE/sf Fighter': {
        name: 'TIE/sf Fighter',
        factions: ["First Order"],
        attack: 2,
        agility: 2,
        hull: 3,
        shields: 3,
        actions: ['Focus', 'Target Lock', 'Barrel Roll'],
        attack_icon: 'xwing-miniatures-font-attack-frontback',
        maneuvers: [[0, 0, 0, 0, 0, 0, 0, 0], [3, 2, 2, 2, 3, 0, 0, 0], [1, 1, 2, 1, 1, 0, 0, 0], [3, 1, 2, 1, 3, 0, 3, 3], [0, 0, 1, 0, 0, 0, 0, 0]]
      },
      'Protectorate Starfighter': {
        name: 'Protectorate Starfighter',
        factions: ["Scum and Villainy"],
        attack: 3,
        agility: 3,
        hull: 4,
        shields: 0,
        actions: ['Focus', 'Target Lock', 'Barrel Roll', 'Boost'],
        maneuvers: [[0, 0, 0, 0, 0, 0, 0, 0, 0, 0], [1, 0, 0, 0, 1, 0, 0, 0, 0, 0], [2, 2, 2, 2, 2, 0, 0, 0, 3, 3], [1, 1, 2, 1, 1, 0, 0, 0, 0, 0], [0, 0, 1, 0, 0, 3, 0, 0, 0, 0], [0, 0, 1, 0, 0, 0, 0, 0, 0, 0]]
      },
      'Lancer-class Pursuit Craft': {
        name: 'Lancer-class Pursuit Craft',
        factions: ["Scum and Villainy"],
        large: true,
        attack: 3,
        agility: 2,
        hull: 7,
        shields: 3,
        actions: ['Focus', 'Target Lock', 'Evade', 'Rotate Arc'],
        maneuvers: [[0, 0, 0, 0, 0, 0], [0, 1, 1, 1, 0, 0], [1, 1, 2, 1, 1, 0], [2, 2, 2, 2, 2, 0], [0, 0, 2, 0, 0, 0], [0, 0, 1, 0, 0, 3]]
      },
      'Upsilon-class Shuttle': {
        name: 'Upsilon-class Shuttle',
        factions: ["First Order"],
        large: true,
        attack: 4,
        agility: 1,
        hull: 6,
        shields: 6,
        actions: ['Focus', 'Target Lock', 'Coordinate'],
        maneuvers: [[0, 0, 3, 0, 0], [3, 1, 2, 1, 3], [1, 2, 2, 2, 1], [3, 1, 1, 1, 3]]
      },
      'Quadjumper': {
        name: 'Quadjumper',
        factions: ["Scum and Villainy"],
        attack: 2,
        agility: 2,
        hull: 5,
        shields: 0,
        actions: ['Barrel Roll', 'Focus'],
        maneuvers: [[0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], [1, 0, 1, 0, 1, 0, 0, 0, 0, 0, 3, 3, 3], [1, 2, 2, 2, 1, 0, 3, 3, 0, 0, 0, 0, 0], [0, 1, 2, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0]]
      },
      'U-Wing': {
        name: 'U-Wing',
        factions: ["Rebel Alliance"],
        large: true,
        attack: 3,
        agility: 1,
        hull: 4,
        shields: 4,
        actions: ['Focus', 'Target Lock'],
        maneuvers: [[0, 0, 3, 0, 0], [0, 2, 2, 2, 0], [1, 2, 2, 2, 1], [0, 1, 1, 1, 0], [0, 0, 1, 0, 0]]
      },
      'TIE Striker': {
        name: 'TIE Striker',
        factions: ["Galactic Empire"],
        attack: 3,
        agility: 2,
        hull: 4,
        shields: 0,
        actions: ['Focus', 'Barrel Roll', 'Evade'],
        maneuvers: [[0, 0, 0, 0, 0, 0, 0, 0], [1, 2, 2, 2, 1, 0, 0, 0], [1, 1, 2, 1, 1, 3, 3, 3], [0, 1, 2, 1, 0, 0, 0, 0]]
      },
      "C-ROC Cruiser": {
        name: "C-ROC Cruiser",
        factions: ["Scum and Villainy"],
        energy: 4,
        agility: 0,
        hull: 10,
        shields: 4,
        huge: true,
        actions: ["Recover", "Reinforce", "Target Lock", "Jam"],
        maneuvers: [[0, 0, 0, 0, 0, 0], [0, 1, 1, 1, 0, 0], [0, 1, 1, 1, 0, 0], [0, 0, 1, 0, 0, 0], [0, 0, 1, 0, 0, 0]]
      },
      'Auzituck Gunship': {
        name: 'Auzituck Gunship',
        factions: ["Rebel Alliance"],
        attack: 3,
        agility: 1,
        hull: 6,
        shields: 3,
        actions: ['Focus', 'Reinforce'],
        attack_icon: 'xwing-miniatures-font-attack-180',
        maneuvers: [[0, 0, 0, 0, 0, 0, 0, 0], [0, 2, 2, 2, 0, 0, 0, 0], [1, 1, 2, 1, 1, 0, 0, 0], [1, 1, 2, 1, 1, 0, 0, 0], [0, 0, 1, 0, 0, 0, 0, 0], [0, 0, 3, 0, 0, 0, 0, 0]]
      },
      'Scurrg H-6 Bomber': {
        name: 'Scurrg H-6 Bomber',
        factions: ["Rebel Alliance", "Scum and Villainy"],
        attack: 3,
        agility: 1,
        hull: 5,
        shields: 5,
        actions: ['Focus', 'Target Lock', 'Barrel Roll'],
        maneuvers: [[0, 0, 0, 0, 0, 0, 0, 0, 0, 0], [0, 1, 2, 1, 0, 0, 0, 0, 0, 0], [1, 2, 2, 2, 1, 0, 0, 0, 0, 0], [3, 1, 2, 1, 3, 0, 0, 0, 3, 3], [0, 0, 1, 0, 0, 0, 0, 0, 0, 0], [0, 0, 3, 0, 0, 0, 0, 0, 0, 0]]
      },
      'TIE Aggressor': {
        name: 'TIE Aggressor',
        factions: ["Galactic Empire"],
        attack: 2,
        agility: 2,
        hull: 4,
        shields: 1,
        actions: ['Focus', 'Target Lock', 'Barrel Roll'],
        maneuvers: [[0, 0, 0, 0, 0, 0, 0, 0, 0, 0], [0, 1, 2, 1, 0, 0, 0, 0, 0, 0], [1, 2, 2, 2, 1, 0, 0, 0, 0, 0], [1, 1, 2, 1, 1, 0, 0, 0, 0, 0], [0, 0, 1, 0, 0, 3, 0, 0, 0, 0]]
      },
      'Alpha-class Star Wing': {
        name: 'Alpha-class Star Wing',
        factions: ["Disabled"],
        attack: 2,
        agility: 2,
        hull: 4,
        shields: 3,
        actions: ['Target Lock', 'Focus', 'SLAM', 'Reload']
      },
      'M12-L Kimogila Fighter': {
        name: 'M12-L Kimogila Fighter',
        factions: ["Disabled"],
        attack: 3,
        agility: 1,
        hull: 6,
        shields: 2,
        actions: ['Target Lock', 'Focus', 'Barrel Roll', 'Reload']
      },
      'Sheathipede-class Shuttle': {
        name: 'Sheathipede-class Shuttle',
        factions: ["Disabled"],
        attack: 2,
        agility: 2,
        hull: 4,
        shields: 1,
        actions: ['Focus', 'Target Lock', 'Coordinate'],
        attack_icon: 'xwing-miniatures-font-attack-frontback'
      },
      'B/SF-17 Bomber': {
        name: 'B/SF-17 Bomber',
        factions: ["Disabled"],
        large: true,
        attack: 2,
        agility: 1,
        hull: 9,
        shields: 3,
        actions: ['Focus', 'Target Lock'],
        attack_icon: 'xwing-miniatures-font-attack-turret'
      },
      'TIE Silencer': {
        name: 'TIE Silencer',
        factions: ["Disabled"],
        attack: 3,
        agility: 3,
        hull: 4,
        shields: 2,
        actions: ['Focus', 'Barrel Roll', 'Boost', 'Target Lock']
      }
    },
    pilotsById: [
      {
        name: "Wedge Antilles",
        faction: "Rebel Alliance",
        id: 0,
        unique: true,
        ship: "X-Wing",
        skill: 9,
        points: 29,
        slots: ["Elite", "Torpedo", "Astromech"]
      }, {
        name: "Garven Dreis",
        faction: "Rebel Alliance",
        id: 1,
        unique: true,
        ship: "X-Wing",
        skill: 6,
        points: 26,
        slots: ["Torpedo", "Astromech"]
      }, {
        name: "Red Squadron Pilot",
        faction: "Rebel Alliance",
        id: 2,
        ship: "X-Wing",
        skill: 4,
        points: 23,
        slots: ["Torpedo", "Astromech"]
      }, {
        name: "Rookie Pilot",
        faction: "Rebel Alliance",
        id: 3,
        ship: "X-Wing",
        skill: 2,
        points: 21,
        slots: ["Torpedo", "Astromech"]
      }, {
        name: "Biggs Darklighter",
        faction: "Rebel Alliance",
        id: 4,
        unique: true,
        ship: "X-Wing",
        skill: 5,
        points: 25,
        slots: ["Torpedo", "Astromech"]
      }, {
        name: "Luke Skywalker",
        faction: "Rebel Alliance",
        id: 5,
        unique: true,
        ship: "X-Wing",
        skill: 8,
        points: 28,
        slots: ["Elite", "Torpedo", "Astromech"]
      }, {
        name: "Gray Squadron Pilot",
        faction: "Rebel Alliance",
        id: 6,
        ship: "Y-Wing",
        skill: 4,
        points: 20,
        slots: ["Turret", "Torpedo", "Torpedo", "Astromech"]
      }, {
        name: '"Dutch" Vander',
        faction: "Rebel Alliance",
        id: 7,
        unique: true,
        ship: "Y-Wing",
        skill: 6,
        points: 23,
        slots: ["Turret", "Torpedo", "Torpedo", "Astromech"]
      }, {
        name: "Horton Salm",
        faction: "Rebel Alliance",
        id: 8,
        unique: true,
        ship: "Y-Wing",
        skill: 8,
        points: 25,
        slots: ["Turret", "Torpedo", "Torpedo", "Astromech"]
      }, {
        name: "Gold Squadron Pilot",
        faction: "Rebel Alliance",
        id: 9,
        ship: "Y-Wing",
        skill: 2,
        points: 18,
        slots: ["Turret", "Torpedo", "Torpedo", "Astromech"]
      }, {
        name: "Academy Pilot",
        faction: "Galactic Empire",
        id: 10,
        ship: "TIE Fighter",
        skill: 1,
        points: 12,
        slots: []
      }, {
        name: "Obsidian Squadron Pilot",
        faction: "Galactic Empire",
        id: 11,
        ship: "TIE Fighter",
        skill: 3,
        points: 13,
        slots: []
      }, {
        name: "Black Squadron Pilot",
        faction: "Galactic Empire",
        id: 12,
        ship: "TIE Fighter",
        skill: 4,
        points: 14,
        slots: ["Elite"]
      }, {
        name: '"Winged Gundark"',
        faction: "Galactic Empire",
        id: 13,
        unique: true,
        ship: "TIE Fighter",
        skill: 5,
        points: 15,
        slots: []
      }, {
        name: '"Night Beast"',
        faction: "Galactic Empire",
        id: 14,
        unique: true,
        ship: "TIE Fighter",
        skill: 5,
        points: 15,
        slots: []
      }, {
        name: '"Backstabber"',
        faction: "Galactic Empire",
        id: 15,
        unique: true,
        ship: "TIE Fighter",
        skill: 6,
        points: 16,
        slots: []
      }, {
        name: '"Dark Curse"',
        faction: "Galactic Empire",
        id: 16,
        unique: true,
        ship: "TIE Fighter",
        skill: 6,
        points: 16,
        slots: []
      }, {
        name: '"Mauler Mithel"',
        faction: "Galactic Empire",
        id: 17,
        unique: true,
        ship: "TIE Fighter",
        skill: 7,
        points: 17,
        slots: ["Elite"]
      }, {
        name: '"Howlrunner"',
        faction: "Galactic Empire",
        id: 18,
        unique: true,
        ship: "TIE Fighter",
        skill: 8,
        points: 18,
        slots: ["Elite"]
      }, {
        name: "Maarek Stele",
        faction: "Galactic Empire",
        id: 19,
        unique: true,
        ship: "TIE Advanced",
        skill: 7,
        points: 27,
        slots: ["Elite", "Missile"]
      }, {
        name: "Tempest Squadron Pilot",
        faction: "Galactic Empire",
        id: 20,
        ship: "TIE Advanced",
        skill: 2,
        points: 21,
        slots: ["Missile"]
      }, {
        name: "Storm Squadron Pilot",
        faction: "Galactic Empire",
        id: 21,
        ship: "TIE Advanced",
        skill: 4,
        points: 23,
        slots: ["Missile"]
      }, {
        name: "Darth Vader",
        faction: "Galactic Empire",
        id: 22,
        unique: true,
        ship: "TIE Advanced",
        skill: 9,
        points: 29,
        slots: ["Elite", "Missile"]
      }, {
        name: "Alpha Squadron Pilot",
        faction: "Galactic Empire",
        id: 23,
        ship: "TIE Interceptor",
        skill: 1,
        points: 18,
        slots: []
      }, {
        name: "Avenger Squadron Pilot",
        faction: "Galactic Empire",
        id: 24,
        ship: "TIE Interceptor",
        skill: 3,
        points: 20,
        slots: []
      }, {
        name: "Saber Squadron Pilot",
        faction: "Galactic Empire",
        id: 25,
        ship: "TIE Interceptor",
        skill: 4,
        points: 21,
        slots: ["Elite"]
      }, {
        name: "\"Fel's Wrath\"",
        faction: "Galactic Empire",
        id: 26,
        unique: true,
        ship: "TIE Interceptor",
        skill: 5,
        points: 23,
        slots: []
      }, {
        name: "Turr Phennir",
        faction: "Galactic Empire",
        id: 27,
        unique: true,
        ship: "TIE Interceptor",
        skill: 7,
        points: 25,
        slots: ["Elite"]
      }, {
        name: "Soontir Fel",
        faction: "Galactic Empire",
        id: 28,
        unique: true,
        ship: "TIE Interceptor",
        skill: 9,
        points: 27,
        slots: ["Elite"]
      }, {
        name: "Tycho Celchu",
        faction: "Rebel Alliance",
        id: 29,
        unique: true,
        ship: "A-Wing",
        skill: 8,
        points: 26,
        slots: ["Elite", "Missile"]
      }, {
        name: "Arvel Crynyd",
        faction: "Rebel Alliance",
        id: 30,
        unique: true,
        ship: "A-Wing",
        skill: 6,
        points: 23,
        slots: ["Missile"]
      }, {
        name: "Green Squadron Pilot",
        faction: "Rebel Alliance",
        id: 31,
        ship: "A-Wing",
        skill: 3,
        points: 19,
        slots: ["Elite", "Missile"]
      }, {
        name: "Prototype Pilot",
        faction: "Rebel Alliance",
        id: 32,
        ship: "A-Wing",
        skill: 1,
        points: 17,
        slots: ["Missile"]
      }, {
        name: "Outer Rim Smuggler",
        faction: "Rebel Alliance",
        id: 33,
        ship: "YT-1300",
        skill: 1,
        points: 27,
        slots: ["Crew", "Crew"]
      }, {
        name: "Chewbacca",
        faction: "Rebel Alliance",
        id: 34,
        unique: true,
        ship: "YT-1300",
        skill: 5,
        points: 42,
        slots: ["Elite", "Missile", "Crew", "Crew"],
        ship_override: {
          attack: 3,
          agility: 1,
          hull: 8,
          shields: 5
        }
      }, {
        name: "Lando Calrissian",
        faction: "Rebel Alliance",
        id: 35,
        unique: true,
        ship: "YT-1300",
        skill: 7,
        points: 44,
        slots: ["Elite", "Missile", "Crew", "Crew"],
        ship_override: {
          attack: 3,
          agility: 1,
          hull: 8,
          shields: 5
        }
      }, {
        name: "Han Solo",
        faction: "Rebel Alliance",
        id: 36,
        unique: true,
        ship: "YT-1300",
        skill: 9,
        points: 46,
        slots: ["Elite", "Missile", "Crew", "Crew"],
        ship_override: {
          attack: 3,
          agility: 1,
          hull: 8,
          shields: 5
        }
      }, {
        name: "Kath Scarlet",
        faction: "Galactic Empire",
        id: 37,
        unique: true,
        ship: "Firespray-31",
        skill: 7,
        points: 38,
        slots: ["Elite", "Cannon", "Bomb", "Crew", "Missile"]
      }, {
        name: "Boba Fett",
        faction: "Galactic Empire",
        id: 38,
        unique: true,
        ship: "Firespray-31",
        skill: 8,
        points: 39,
        slots: ["Elite", "Cannon", "Bomb", "Crew", "Missile"]
      }, {
        name: "Krassis Trelix",
        faction: "Galactic Empire",
        id: 39,
        unique: true,
        ship: "Firespray-31",
        skill: 5,
        points: 36,
        slots: ["Cannon", "Bomb", "Crew", "Missile"]
      }, {
        name: "Bounty Hunter",
        faction: "Galactic Empire",
        id: 40,
        ship: "Firespray-31",
        skill: 3,
        points: 33,
        slots: ["Cannon", "Bomb", "Crew", "Missile"]
      }, {
        name: "Ten Numb",
        faction: "Rebel Alliance",
        id: 41,
        unique: true,
        ship: "B-Wing",
        skill: 8,
        points: 31,
        slots: ["Elite", "System", "Cannon", "Torpedo", "Torpedo"]
      }, {
        name: "Ibtisam",
        faction: "Rebel Alliance",
        id: 42,
        unique: true,
        ship: "B-Wing",
        skill: 6,
        points: 28,
        slots: ["Elite", "System", "Cannon", "Torpedo", "Torpedo"]
      }, {
        name: "Dagger Squadron Pilot",
        faction: "Rebel Alliance",
        id: 43,
        ship: "B-Wing",
        skill: 4,
        points: 24,
        slots: ["System", "Cannon", "Torpedo", "Torpedo"]
      }, {
        name: "Blue Squadron Pilot",
        faction: "Rebel Alliance",
        id: 44,
        ship: "B-Wing",
        skill: 2,
        points: 22,
        slots: ["System", "Cannon", "Torpedo", "Torpedo"]
      }, {
        name: "Rebel Operative",
        faction: "Rebel Alliance",
        id: 45,
        ship: "HWK-290",
        skill: 2,
        points: 16,
        slots: ["Turret", "Crew"]
      }, {
        name: "Roark Garnet",
        faction: "Rebel Alliance",
        id: 46,
        unique: true,
        ship: "HWK-290",
        skill: 4,
        points: 19,
        slots: ["Turret", "Crew"]
      }, {
        name: "Kyle Katarn",
        faction: "Rebel Alliance",
        id: 47,
        unique: true,
        ship: "HWK-290",
        skill: 6,
        points: 21,
        slots: ["Elite", "Turret", "Crew"]
      }, {
        name: "Jan Ors",
        faction: "Rebel Alliance",
        id: 48,
        unique: true,
        ship: "HWK-290",
        skill: 8,
        points: 25,
        slots: ["Elite", "Turret", "Crew"]
      }, {
        name: "Scimitar Squadron Pilot",
        faction: "Galactic Empire",
        id: 49,
        ship: "TIE Bomber",
        skill: 2,
        points: 16,
        slots: ["Torpedo", "Torpedo", "Missile", "Missile", "Bomb"]
      }, {
        name: "Gamma Squadron Pilot",
        faction: "Galactic Empire",
        id: 50,
        ship: "TIE Bomber",
        skill: 4,
        points: 18,
        slots: ["Torpedo", "Torpedo", "Missile", "Missile", "Bomb"]
      }, {
        name: "Captain Jonus",
        faction: "Galactic Empire",
        id: 51,
        unique: true,
        ship: "TIE Bomber",
        skill: 6,
        points: 22,
        slots: ["Elite", "Torpedo", "Torpedo", "Missile", "Missile", "Bomb"]
      }, {
        name: "Major Rhymer",
        faction: "Galactic Empire",
        id: 52,
        unique: true,
        ship: "TIE Bomber",
        skill: 7,
        points: 26,
        slots: ["Elite", "Torpedo", "Torpedo", "Missile", "Missile", "Bomb"]
      }, {
        name: "Captain Kagi",
        faction: "Galactic Empire",
        id: 53,
        unique: true,
        ship: "Lambda-Class Shuttle",
        skill: 8,
        points: 27,
        slots: ["System", "Cannon", "Crew", "Crew"]
      }, {
        name: "Colonel Jendon",
        faction: "Galactic Empire",
        id: 54,
        unique: true,
        ship: "Lambda-Class Shuttle",
        skill: 6,
        points: 26,
        slots: ["System", "Cannon", "Crew", "Crew"]
      }, {
        name: "Captain Yorr",
        faction: "Galactic Empire",
        id: 55,
        unique: true,
        ship: "Lambda-Class Shuttle",
        skill: 4,
        points: 24,
        slots: ["System", "Cannon", "Crew", "Crew"]
      }, {
        name: "Omicron Group Pilot",
        faction: "Galactic Empire",
        id: 56,
        ship: "Lambda-Class Shuttle",
        skill: 2,
        points: 21,
        slots: ["System", "Cannon", "Crew", "Crew"]
      }, {
        name: "Lieutenant Lorrir",
        faction: "Galactic Empire",
        id: 57,
        unique: true,
        ship: "TIE Interceptor",
        skill: 5,
        points: 23,
        slots: []
      }, {
        name: "Royal Guard Pilot",
        faction: "Galactic Empire",
        id: 58,
        ship: "TIE Interceptor",
        skill: 6,
        points: 22,
        slots: ["Elite"]
      }, {
        name: "Tetran Cowall",
        faction: "Galactic Empire",
        id: 59,
        unique: true,
        ship: "TIE Interceptor",
        skill: 7,
        points: 24,
        slots: ["Elite"],
        modifier_func: function(stats) {
          return stats.maneuvers[1][5] = 3;
        }
      }, {
        name: "I messed up this pilot, sorry",
        id: 60,
        skip: true
      }, {
        name: "Kir Kanos",
        faction: "Galactic Empire",
        id: 61,
        unique: true,
        ship: "TIE Interceptor",
        skill: 6,
        points: 24,
        slots: []
      }, {
        name: "Carnor Jax",
        faction: "Galactic Empire",
        id: 62,
        unique: true,
        ship: "TIE Interceptor",
        skill: 8,
        points: 26,
        slots: ["Elite"]
      }, {
        name: "GR-75 Medium Transport",
        faction: "Rebel Alliance",
        id: 63,
        epic: true,
        ship: "GR-75 Medium Transport",
        skill: 3,
        points: 30,
        slots: ["Crew", "Crew", "Cargo", "Cargo", "Cargo"]
      }, {
        name: "Bandit Squadron Pilot",
        faction: "Rebel Alliance",
        id: 64,
        ship: "Z-95 Headhunter",
        skill: 2,
        points: 12,
        slots: ["Missile"]
      }, {
        name: "Tala Squadron Pilot",
        faction: "Rebel Alliance",
        id: 65,
        ship: "Z-95 Headhunter",
        skill: 4,
        points: 13,
        slots: ["Missile"]
      }, {
        name: "Lieutenant Blount",
        faction: "Rebel Alliance",
        id: 66,
        unique: true,
        ship: "Z-95 Headhunter",
        skill: 6,
        points: 17,
        slots: ["Elite", "Missile"]
      }, {
        name: "Airen Cracken",
        faction: "Rebel Alliance",
        id: 67,
        unique: true,
        ship: "Z-95 Headhunter",
        skill: 8,
        points: 19,
        slots: ["Elite", "Missile"]
      }, {
        name: "Delta Squadron Pilot",
        faction: "Galactic Empire",
        id: 68,
        ship: "TIE Defender",
        skill: 1,
        points: 30,
        slots: ["Cannon", "Missile"]
      }, {
        name: "Onyx Squadron Pilot",
        faction: "Galactic Empire",
        id: 69,
        ship: "TIE Defender",
        skill: 3,
        points: 32,
        slots: ["Cannon", "Missile"]
      }, {
        name: "Colonel Vessery",
        faction: "Galactic Empire",
        id: 70,
        unique: true,
        ship: "TIE Defender",
        skill: 6,
        points: 35,
        slots: ["Elite", "Cannon", "Missile"]
      }, {
        name: "Rexler Brath",
        faction: "Galactic Empire",
        id: 71,
        unique: true,
        ship: "TIE Defender",
        skill: 8,
        points: 37,
        slots: ["Elite", "Cannon", "Missile"]
      }, {
        name: "Knave Squadron Pilot",
        faction: "Rebel Alliance",
        id: 72,
        ship: "E-Wing",
        skill: 1,
        points: 27,
        slots: ["System", "Torpedo", "Astromech"]
      }, {
        name: "Blackmoon Squadron Pilot",
        faction: "Rebel Alliance",
        id: 73,
        ship: "E-Wing",
        skill: 3,
        points: 29,
        slots: ["System", "Torpedo", "Astromech"]
      }, {
        name: "Etahn A'baht",
        faction: "Rebel Alliance",
        id: 74,
        unique: true,
        ship: "E-Wing",
        skill: 5,
        points: 32,
        slots: ["Elite", "System", "Torpedo", "Astromech"]
      }, {
        name: "Corran Horn",
        faction: "Rebel Alliance",
        id: 75,
        unique: true,
        ship: "E-Wing",
        skill: 8,
        points: 35,
        slots: ["Elite", "System", "Torpedo", "Astromech"]
      }, {
        name: "Sigma Squadron Pilot",
        faction: "Galactic Empire",
        id: 76,
        ship: "TIE Phantom",
        skill: 3,
        points: 25,
        slots: ["System", "Crew"]
      }, {
        name: "Shadow Squadron Pilot",
        faction: "Galactic Empire",
        id: 77,
        ship: "TIE Phantom",
        skill: 5,
        points: 27,
        slots: ["System", "Crew"]
      }, {
        name: '"Echo"',
        faction: "Galactic Empire",
        id: 78,
        unique: true,
        ship: "TIE Phantom",
        skill: 6,
        points: 30,
        slots: ["Elite", "System", "Crew"]
      }, {
        name: '"Whisper"',
        faction: "Galactic Empire",
        id: 79,
        unique: true,
        ship: "TIE Phantom",
        skill: 7,
        points: 32,
        slots: ["Elite", "System", "Crew"]
      }, {
        name: "CR90 Corvette (Fore)",
        faction: "Rebel Alliance",
        id: 80,
        epic: true,
        ship: "CR90 Corvette (Fore)",
        skill: 4,
        points: 50,
        slots: ["Crew", "Hardpoint", "Hardpoint", "Team", "Team", "Cargo"]
      }, {
        name: "CR90 Corvette (Aft)",
        faction: "Rebel Alliance",
        id: 81,
        epic: true,
        ship: "CR90 Corvette (Aft)",
        skill: 4,
        points: 40,
        slots: ["Crew", "Hardpoint", "Team", "Cargo"]
      }, {
        name: "Wes Janson",
        faction: "Rebel Alliance",
        id: 82,
        unique: true,
        ship: "X-Wing",
        skill: 8,
        points: 29,
        slots: ["Elite", "Torpedo", "Astromech"]
      }, {
        name: "Jek Porkins",
        faction: "Rebel Alliance",
        id: 83,
        unique: true,
        ship: "X-Wing",
        skill: 7,
        points: 26,
        slots: ["Elite", "Torpedo", "Astromech"]
      }, {
        name: '"Hobbie" Klivian',
        faction: "Rebel Alliance",
        id: 84,
        unique: true,
        ship: "X-Wing",
        skill: 5,
        points: 25,
        slots: ["Torpedo", "Astromech"]
      }, {
        name: "Tarn Mison",
        faction: "Rebel Alliance",
        id: 85,
        unique: true,
        ship: "X-Wing",
        skill: 3,
        points: 23,
        slots: ["Torpedo", "Astromech"]
      }, {
        name: "Jake Farrell",
        faction: "Rebel Alliance",
        id: 86,
        unique: true,
        ship: "A-Wing",
        skill: 7,
        points: 24,
        slots: ["Elite", "Missile"]
      }, {
        name: "Gemmer Sojan",
        faction: "Rebel Alliance",
        id: 87,
        unique: true,
        ship: "A-Wing",
        skill: 5,
        points: 22,
        slots: ["Missile"]
      }, {
        name: "Keyan Farlander",
        faction: "Rebel Alliance",
        id: 88,
        unique: true,
        ship: "B-Wing",
        skill: 7,
        points: 29,
        slots: ["Elite", "System", "Cannon", "Torpedo", "Torpedo"]
      }, {
        name: "Nera Dantels",
        faction: "Rebel Alliance",
        id: 89,
        unique: true,
        ship: "B-Wing",
        skill: 5,
        points: 26,
        slots: ["Elite", "System", "Cannon", "Torpedo", "Torpedo"]
      }, {
        name: "CR90 Corvette (Crippled Fore)",
        skip: true,
        faction: "Rebel Alliance",
        id: 90,
        ship: "CR90 Corvette (Fore)",
        skill: 4,
        points: 0,
        epic: true,
        slots: ["Crew"],
        ship_override: {
          attack: 2,
          agility: 0,
          hull: 0,
          shields: 0,
          actions: []
        }
      }, {
        name: "CR90 Corvette (Crippled Aft)",
        skip: true,
        faction: "Rebel Alliance",
        id: 91,
        ship: "CR90 Corvette (Aft)",
        skill: 4,
        points: 0,
        epic: true,
        slots: ["Cargo"],
        ship_override: {
          energy: 1,
          agility: 0,
          hull: 0,
          shields: 0,
          actions: []
        },
        modifier_func: function(stats) {
          stats.maneuvers[2][1] = 0;
          stats.maneuvers[2][3] = 0;
          return stats.maneuvers[4][2] = 0;
        }
      }, {
        name: "Wild Space Fringer",
        faction: "Rebel Alliance",
        id: 92,
        ship: "YT-2400",
        skill: 2,
        points: 30,
        slots: ["Cannon", "Missile", "Crew"]
      }, {
        name: "Eaden Vrill",
        faction: "Rebel Alliance",
        id: 93,
        ship: "YT-2400",
        unique: true,
        skill: 3,
        points: 32,
        slots: ["Cannon", "Missile", "Crew"]
      }, {
        name: '"Leebo"',
        faction: "Rebel Alliance",
        id: 94,
        ship: "YT-2400",
        unique: true,
        skill: 5,
        points: 34,
        slots: ["Elite", "Cannon", "Missile", "Crew"]
      }, {
        name: "Dash Rendar",
        faction: "Rebel Alliance",
        id: 95,
        ship: "YT-2400",
        unique: true,
        skill: 7,
        points: 36,
        slots: ["Elite", "Cannon", "Missile", "Crew"]
      }, {
        name: "Patrol Leader",
        faction: "Galactic Empire",
        id: 96,
        ship: "VT-49 Decimator",
        skill: 3,
        points: 40,
        slots: ["Torpedo", "Crew", "Crew", "Crew", "Bomb"]
      }, {
        name: "Captain Oicunn",
        faction: "Galactic Empire",
        id: 97,
        ship: "VT-49 Decimator",
        skill: 4,
        points: 42,
        unique: true,
        slots: ["Elite", "Torpedo", "Crew", "Crew", "Crew", "Bomb"]
      }, {
        name: "Commander Kenkirk",
        faction: "Galactic Empire",
        id: 98,
        ship: "VT-49 Decimator",
        skill: 6,
        points: 44,
        unique: true,
        slots: ["Elite", "Torpedo", "Crew", "Crew", "Crew", "Bomb"]
      }, {
        name: "Rear Admiral Chiraneau",
        faction: "Galactic Empire",
        id: 99,
        ship: "VT-49 Decimator",
        skill: 8,
        points: 46,
        unique: true,
        slots: ["Elite", "Torpedo", "Crew", "Crew", "Crew", "Bomb"]
      }, {
        name: "Prince Xizor",
        faction: "Scum and Villainy",
        id: 100,
        unique: true,
        ship: "StarViper",
        skill: 7,
        points: 31,
        slots: ["Elite", "Torpedo"]
      }, {
        name: "Guri",
        faction: "Scum and Villainy",
        id: 101,
        unique: true,
        ship: "StarViper",
        skill: 5,
        points: 30,
        slots: ["Elite", "Torpedo"]
      }, {
        name: "Black Sun Vigo",
        faction: "Scum and Villainy",
        id: 102,
        ship: "StarViper",
        skill: 3,
        points: 27,
        slots: ["Torpedo"]
      }, {
        name: "Black Sun Enforcer",
        faction: "Scum and Villainy",
        id: 103,
        ship: "StarViper",
        skill: 1,
        points: 25,
        slots: ["Torpedo"]
      }, {
        name: "Serissu",
        faction: "Scum and Villainy",
        id: 104,
        ship: "M3-A Interceptor",
        skill: 8,
        points: 20,
        unique: true,
        slots: ["Elite"]
      }, {
        name: "Laetin A'shera",
        faction: "Scum and Villainy",
        id: 105,
        ship: "M3-A Interceptor",
        skill: 6,
        points: 18,
        unique: true,
        slots: []
      }, {
        name: "Tansarii Point Veteran",
        faction: "Scum and Villainy",
        id: 106,
        ship: "M3-A Interceptor",
        skill: 5,
        points: 17,
        slots: ["Elite"]
      }, {
        name: "Cartel Spacer",
        faction: "Scum and Villainy",
        id: 107,
        ship: "M3-A Interceptor",
        skill: 2,
        points: 14,
        slots: []
      }, {
        name: "IG-88A",
        faction: "Scum and Villainy",
        id: 108,
        unique: true,
        ship: "Aggressor",
        skill: 6,
        points: 36,
        slots: ["Elite", "System", "Cannon", "Cannon", "Bomb", "Illicit"]
      }, {
        name: "IG-88B",
        faction: "Scum and Villainy",
        id: 109,
        unique: true,
        ship: "Aggressor",
        skill: 6,
        points: 36,
        slots: ["Elite", "System", "Cannon", "Cannon", "Bomb", "Illicit"]
      }, {
        name: "IG-88C",
        faction: "Scum and Villainy",
        id: 110,
        unique: true,
        ship: "Aggressor",
        skill: 6,
        points: 36,
        slots: ["Elite", "System", "Cannon", "Cannon", "Bomb", "Illicit"]
      }, {
        name: "IG-88D",
        faction: "Scum and Villainy",
        id: 111,
        unique: true,
        ship: "Aggressor",
        skill: 6,
        points: 36,
        slots: ["Elite", "System", "Cannon", "Cannon", "Bomb", "Illicit"]
      }, {
        name: "N'Dru Suhlak",
        unique: true,
        faction: "Scum and Villainy",
        id: 112,
        ship: "Z-95 Headhunter",
        skill: 7,
        points: 17,
        slots: ["Elite", "Missile", "Illicit"]
      }, {
        name: "Kaa'to Leeachos",
        unique: true,
        faction: "Scum and Villainy",
        id: 113,
        ship: "Z-95 Headhunter",
        skill: 5,
        points: 15,
        slots: ["Elite", "Missile", "Illicit"]
      }, {
        name: "Black Sun Soldier",
        faction: "Scum and Villainy",
        id: 114,
        ship: "Z-95 Headhunter",
        skill: 3,
        points: 13,
        slots: ["Missile", "Illicit"]
      }, {
        name: "Binayre Pirate",
        faction: "Scum and Villainy",
        id: 115,
        ship: "Z-95 Headhunter",
        skill: 1,
        points: 12,
        slots: ["Missile", "Illicit"]
      }, {
        name: "Boba Fett (Scum)",
        canonical_name: 'Boba Fett'.canonicalize(),
        faction: "Scum and Villainy",
        id: 116,
        ship: "Firespray-31",
        skill: 8,
        points: 39,
        unique: true,
        slots: ["Elite", "Cannon", "Bomb", "Crew", "Missile", "Illicit"]
      }, {
        name: "Kath Scarlet (Scum)",
        canonical_name: 'Kath Scarlet'.canonicalize(),
        unique: true,
        faction: "Scum and Villainy",
        id: 117,
        ship: "Firespray-31",
        skill: 7,
        points: 38,
        slots: ["Elite", "Cannon", "Bomb", "Crew", "Missile", "Illicit"]
      }, {
        name: "Emon Azzameen",
        unique: true,
        faction: "Scum and Villainy",
        id: 118,
        ship: "Firespray-31",
        skill: 6,
        points: 36,
        slots: ["Cannon", "Bomb", "Crew", "Missile", "Illicit"]
      }, {
        name: "Mandalorian Mercenary",
        faction: "Scum and Villainy",
        id: 119,
        ship: "Firespray-31",
        skill: 5,
        points: 35,
        slots: ["Elite", "Cannon", "Bomb", "Crew", "Missile", "Illicit"]
      }, {
        name: "Kavil",
        unique: true,
        faction: "Scum and Villainy",
        id: 120,
        ship: "Y-Wing",
        skill: 7,
        points: 24,
        slots: ["Elite", "Turret", "Torpedo", "Torpedo", "Salvaged Astromech"]
      }, {
        name: "Drea Renthal",
        unique: true,
        faction: "Scum and Villainy",
        id: 121,
        ship: "Y-Wing",
        skill: 5,
        points: 22,
        slots: ["Turret", "Torpedo", "Torpedo", "Salvaged Astromech"]
      }, {
        name: "Hired Gun",
        faction: "Scum and Villainy",
        id: 122,
        ship: "Y-Wing",
        skill: 4,
        points: 20,
        slots: ["Turret", "Torpedo", "Torpedo", "Salvaged Astromech"]
      }, {
        name: "Syndicate Thug",
        faction: "Scum and Villainy",
        id: 123,
        ship: "Y-Wing",
        skill: 2,
        points: 18,
        slots: ["Turret", "Torpedo", "Torpedo", "Salvaged Astromech"]
      }, {
        name: "Dace Bonearm",
        unique: true,
        faction: "Scum and Villainy",
        id: 124,
        ship: "HWK-290",
        skill: 7,
        points: 23,
        slots: ["Elite", "Turret", "Crew", "Illicit"]
      }, {
        name: "Palob Godalhi",
        unique: true,
        faction: "Scum and Villainy",
        id: 125,
        ship: "HWK-290",
        skill: 5,
        points: 20,
        slots: ["Elite", "Turret", "Crew", "Illicit"]
      }, {
        name: "Torkil Mux",
        unique: true,
        faction: "Scum and Villainy",
        id: 126,
        ship: "HWK-290",
        skill: 3,
        points: 19,
        slots: ["Turret", "Crew", "Illicit"]
      }, {
        name: "Spice Runner",
        faction: "Scum and Villainy",
        id: 127,
        ship: "HWK-290",
        skill: 1,
        points: 16,
        slots: ["Turret", "Crew", "Illicit"]
      }, {
        name: "Commander Alozen",
        faction: "Galactic Empire",
        id: 128,
        ship: "TIE Advanced",
        unique: true,
        skill: 5,
        points: 25,
        slots: ["Elite", "Missile"]
      }, {
        name: "Raider-class Corvette (Fore)",
        faction: "Galactic Empire",
        id: 129,
        ship: "Raider-class Corvette (Fore)",
        skill: 4,
        points: 50,
        epic: true,
        slots: ["Hardpoint", "Team", "Cargo"]
      }, {
        name: "Raider-class Corvette (Aft)",
        faction: "Galactic Empire",
        id: 130,
        ship: "Raider-class Corvette (Aft)",
        skill: 4,
        points: 50,
        epic: true,
        slots: ["Crew", "Crew", "Hardpoint", "Hardpoint", "Team", "Team", "Cargo"]
      }, {
        name: "Bossk",
        faction: "Scum and Villainy",
        id: 131,
        ship: "YV-666",
        unique: true,
        skill: 7,
        points: 35,
        slots: ["Elite", "Cannon", "Missile", "Crew", "Crew", "Crew", "Illicit"]
      }, {
        name: "Moralo Eval",
        faction: "Scum and Villainy",
        id: 132,
        ship: "YV-666",
        unique: true,
        skill: 6,
        points: 34,
        slots: ["Cannon", "Missile", "Crew", "Crew", "Crew", "Illicit"]
      }, {
        name: "Latts Razzi",
        faction: "Scum and Villainy",
        id: 133,
        ship: "YV-666",
        unique: true,
        skill: 5,
        points: 33,
        slots: ["Cannon", "Missile", "Crew", "Crew", "Crew", "Illicit"]
      }, {
        name: "Trandoshan Slaver",
        faction: "Scum and Villainy",
        id: 134,
        ship: "YV-666",
        skill: 2,
        points: 29,
        slots: ["Cannon", "Missile", "Crew", "Crew", "Crew", "Illicit"]
      }, {
        name: "Talonbane Cobra",
        unique: true,
        id: 135,
        faction: "Scum and Villainy",
        ship: "Kihraxz Fighter",
        skill: 9,
        slots: ["Elite", "Missile", "Illicit"],
        points: 28
      }, {
        name: "Graz the Hunter",
        unique: true,
        id: 136,
        faction: "Scum and Villainy",
        ship: "Kihraxz Fighter",
        skill: 6,
        slots: ["Missile", "Illicit"],
        points: 25
      }, {
        name: "Black Sun Ace",
        faction: "Scum and Villainy",
        id: 137,
        ship: "Kihraxz Fighter",
        skill: 5,
        slots: ["Elite", "Missile", "Illicit"],
        points: 23
      }, {
        name: "Cartel Marauder",
        faction: "Scum and Villainy",
        id: 138,
        ship: "Kihraxz Fighter",
        skill: 2,
        slots: ["Missile", "Illicit"],
        points: 20
      }, {
        name: "Miranda Doni",
        unique: true,
        id: 139,
        faction: "Rebel Alliance",
        ship: "K-Wing",
        skill: 8,
        slots: ["Turret", "Torpedo", "Torpedo", "Missile", "Crew", "Bomb", "Bomb"],
        points: 29
      }, {
        name: "Esege Tuketu",
        unique: true,
        id: 140,
        faction: "Rebel Alliance",
        ship: "K-Wing",
        skill: 6,
        slots: ["Turret", "Torpedo", "Torpedo", "Missile", "Crew", "Bomb", "Bomb"],
        points: 28
      }, {
        name: "Guardian Squadron Pilot",
        faction: "Rebel Alliance",
        id: 141,
        ship: "K-Wing",
        skill: 4,
        slots: ["Turret", "Torpedo", "Torpedo", "Missile", "Crew", "Bomb", "Bomb"],
        points: 25
      }, {
        name: "Warden Squadron Pilot",
        faction: "Rebel Alliance",
        id: 142,
        ship: "K-Wing",
        skill: 2,
        slots: ["Turret", "Torpedo", "Torpedo", "Missile", "Crew", "Bomb", "Bomb"],
        points: 23
      }, {
        name: '"Redline"',
        unique: true,
        id: 143,
        faction: "Galactic Empire",
        ship: "TIE Punisher",
        skill: 7,
        slots: ["System", "Torpedo", "Torpedo", "Missile", "Missile", "Bomb", "Bomb"],
        points: 27
      }, {
        name: '"Deathrain"',
        unique: true,
        id: 144,
        faction: "Galactic Empire",
        ship: "TIE Punisher",
        skill: 6,
        slots: ["System", "Torpedo", "Torpedo", "Missile", "Missile", "Bomb", "Bomb"],
        points: 26
      }, {
        name: 'Black Eight Squadron Pilot',
        canonical_name: 'Black Eight Sq. Pilot'.canonicalize(),
        faction: "Galactic Empire",
        id: 145,
        ship: "TIE Punisher",
        skill: 4,
        slots: ["System", "Torpedo", "Torpedo", "Missile", "Missile", "Bomb", "Bomb"],
        points: 23
      }, {
        name: 'Cutlass Squadron Pilot',
        faction: "Galactic Empire",
        id: 146,
        ship: "TIE Punisher",
        skill: 2,
        slots: ["System", "Torpedo", "Torpedo", "Missile", "Missile", "Bomb", "Bomb"],
        points: 21
      }, {
        name: "Juno Eclipse",
        id: 147,
        faction: "Galactic Empire",
        ship: "TIE Advanced",
        unique: true,
        skill: 8,
        points: 28,
        slots: ["Elite", "Missile"]
      }, {
        name: "Zertik Strom",
        id: 148,
        faction: "Galactic Empire",
        ship: "TIE Advanced",
        unique: true,
        skill: 6,
        points: 26,
        slots: ["Elite", "Missile"]
      }, {
        name: "Lieutenant Colzet",
        id: 149,
        faction: "Galactic Empire",
        ship: "TIE Advanced",
        unique: true,
        skill: 3,
        points: 23,
        slots: ["Missile"]
      }, {
        name: "Gozanti-class Cruiser",
        id: 150,
        faction: "Galactic Empire",
        ship: "Gozanti-class Cruiser",
        skill: 2,
        slots: ['Crew', 'Crew', 'Hardpoint', 'Team', 'Cargo', 'Cargo'],
        points: 40
      }, {
        name: '"Scourge"',
        id: 151,
        unique: true,
        faction: "Galactic Empire",
        ship: "TIE Fighter",
        skill: 7,
        slots: ['Elite'],
        points: 17
      }, {
        name: '"Youngster"',
        id: 152,
        unique: true,
        faction: "Galactic Empire",
        ship: "TIE Fighter",
        skill: 6,
        slots: ['Elite', 'ActEPT'],
        points: 15
      }, {
        name: '"Wampa"',
        id: 153,
        unique: true,
        faction: "Galactic Empire",
        ship: "TIE Fighter",
        skill: 4,
        slots: [],
        points: 14
      }, {
        name: '"Chaser"',
        id: 154,
        unique: true,
        faction: "Galactic Empire",
        ship: "TIE Fighter",
        skill: 3,
        slots: [],
        points: 14
      }, {
        name: "Hera Syndulla",
        id: 155,
        unique: true,
        faction: "Rebel Alliance",
        ship: "VCX-100",
        skill: 7,
        slots: ['System', 'Turret', 'Torpedo', 'Torpedo', 'Crew', 'Crew'],
        points: 40
      }, {
        name: "Kanan Jarrus",
        id: 156,
        unique: true,
        faction: "Rebel Alliance",
        ship: "VCX-100",
        skill: 5,
        slots: ['System', 'Turret', 'Torpedo', 'Torpedo', 'Crew', 'Crew'],
        points: 38
      }, {
        name: '"Chopper"',
        id: 157,
        unique: true,
        faction: "Rebel Alliance",
        ship: "VCX-100",
        skill: 4,
        slots: ['System', 'Turret', 'Torpedo', 'Torpedo', 'Crew', 'Crew'],
        points: 37
      }, {
        name: 'Lothal Rebel',
        id: 158,
        faction: "Rebel Alliance",
        ship: "VCX-100",
        skill: 3,
        slots: ['System', 'Turret', 'Torpedo', 'Torpedo', 'Crew', 'Crew'],
        points: 35
      }, {
        name: 'Hera Syndulla (Attack Shuttle)',
        id: 159,
        canonical_name: 'Hera Syndulla'.canonicalize(),
        unique: true,
        faction: "Rebel Alliance",
        ship: "Attack Shuttle",
        skill: 7,
        slots: ['Elite', 'Turret', 'Crew'],
        points: 22
      }, {
        name: 'Sabine Wren',
        id: 160,
        unique: true,
        faction: "Rebel Alliance",
        ship: "Attack Shuttle",
        skill: 5,
        slots: ['Elite', 'Turret', 'Crew'],
        points: 21
      }, {
        name: 'Ezra Bridger',
        id: 161,
        unique: true,
        faction: "Rebel Alliance",
        ship: "Attack Shuttle",
        skill: 4,
        slots: ['Elite', 'Turret', 'Crew'],
        points: 20
      }, {
        name: '"Zeb" Orrelios',
        id: 162,
        unique: true,
        faction: "Rebel Alliance",
        ship: "Attack Shuttle",
        skill: 3,
        slots: ['Turret', 'Crew'],
        points: 18
      }, {
        name: "The Inquisitor",
        id: 163,
        unique: true,
        faction: "Galactic Empire",
        ship: "TIE Advanced Prototype",
        skill: 8,
        slots: ['Elite', 'Missile'],
        points: 25
      }, {
        name: "Valen Rudor",
        id: 164,
        unique: true,
        faction: "Galactic Empire",
        ship: "TIE Advanced Prototype",
        skill: 6,
        slots: ['Elite', 'Missile'],
        points: 22
      }, {
        name: "Baron of the Empire",
        id: 165,
        faction: "Galactic Empire",
        ship: "TIE Advanced Prototype",
        skill: 4,
        slots: ['Elite', 'Missile'],
        points: 19
      }, {
        name: "Sienar Test Pilot",
        id: 166,
        faction: "Galactic Empire",
        ship: "TIE Advanced Prototype",
        skill: 2,
        slots: ['Missile'],
        points: 16
      }, {
        name: "Zuckuss",
        id: 167,
        unique: true,
        faction: "Scum and Villainy",
        ship: "G-1A Starfighter",
        skill: 7,
        slots: ['Elite', 'Crew', 'System', 'Illicit'],
        points: 28
      }, {
        name: "4-LOM",
        id: 168,
        unique: true,
        faction: "Scum and Villainy",
        ship: "G-1A Starfighter",
        skill: 6,
        slots: ['Elite', 'Crew', 'System', 'Illicit'],
        points: 27
      }, {
        name: "Gand Findsman",
        id: 169,
        faction: "Scum and Villainy",
        ship: "G-1A Starfighter",
        skill: 5,
        slots: ['Elite', 'Crew', 'System', 'Illicit'],
        points: 25
      }, {
        name: "Ruthless Freelancer",
        id: 170,
        faction: "Scum and Villainy",
        ship: "G-1A Starfighter",
        skill: 3,
        slots: ['Crew', 'System', 'Illicit'],
        points: 23
      }, {
        name: "Dengar",
        id: 171,
        unique: true,
        faction: "Scum and Villainy",
        ship: "JumpMaster 5000",
        skill: 9,
        slots: ['Elite', 'Torpedo', 'Torpedo', 'Crew', 'Salvaged Astromech', 'Illicit'],
        points: 33
      }, {
        name: "Tel Trevura",
        id: 172,
        unique: true,
        faction: "Scum and Villainy",
        ship: "JumpMaster 5000",
        skill: 7,
        slots: ['Elite', 'Torpedo', 'Torpedo', 'Crew', 'Salvaged Astromech', 'Illicit'],
        points: 30
      }, {
        name: "Manaroo",
        id: 173,
        unique: true,
        faction: "Scum and Villainy",
        ship: "JumpMaster 5000",
        skill: 4,
        slots: ['Elite', 'Torpedo', 'Torpedo', 'Crew', 'Salvaged Astromech', 'Illicit'],
        points: 27
      }, {
        name: "Contracted Scout",
        id: 174,
        faction: "Scum and Villainy",
        ship: "JumpMaster 5000",
        skill: 3,
        slots: ['Elite', 'Torpedo', 'Torpedo', 'Crew', 'Salvaged Astromech', 'Illicit'],
        points: 25
      }, {
        name: "Poe Dameron",
        id: 175,
        unique: true,
        faction: "Resistance",
        ship: "T-70 X-Wing",
        skill: 8,
        slots: ['Elite', 'Torpedo', 'Astromech', 'Tech'],
        points: 31
      }, {
        name: '"Blue Ace"',
        id: 176,
        unique: true,
        faction: "Resistance",
        ship: "T-70 X-Wing",
        skill: 5,
        slots: ['Torpedo', 'Astromech', 'Tech'],
        points: 27
      }, {
        name: "Red Squadron Veteran",
        id: 177,
        faction: "Resistance",
        ship: "T-70 X-Wing",
        skill: 4,
        slots: ['Elite', 'Torpedo', 'Astromech', 'Tech'],
        points: 26
      }, {
        name: "Blue Squadron Novice",
        id: 178,
        faction: "Resistance",
        ship: "T-70 X-Wing",
        skill: 2,
        slots: ['Torpedo', 'Astromech', 'Tech'],
        points: 24
      }, {
        name: '"Omega Ace"',
        id: 179,
        unique: true,
        faction: "First Order",
        ship: "TIE/fo Fighter",
        skill: 7,
        slots: ['Elite', 'Tech'],
        points: 20
      }, {
        name: '"Epsilon Leader"',
        id: 180,
        unique: true,
        faction: "First Order",
        ship: "TIE/fo Fighter",
        skill: 6,
        slots: ['Tech'],
        points: 19
      }, {
        name: '"Zeta Ace"',
        id: 181,
        unique: true,
        faction: "First Order",
        ship: "TIE/fo Fighter",
        skill: 5,
        slots: ['Elite', 'Tech'],
        points: 18
      }, {
        name: "Omega Squadron Pilot",
        id: 182,
        faction: "First Order",
        ship: "TIE/fo Fighter",
        skill: 4,
        slots: ['Elite', 'Tech'],
        points: 17
      }, {
        name: "Zeta Squadron Pilot",
        id: 183,
        faction: "First Order",
        ship: "TIE/fo Fighter",
        skill: 3,
        slots: ['Tech'],
        points: 16
      }, {
        name: "Epsilon Squadron Pilot",
        id: 184,
        faction: "First Order",
        ship: "TIE/fo Fighter",
        skill: 1,
        slots: ['Tech'],
        points: 15
      }, {
        name: "Ello Asty",
        id: 185,
        unique: true,
        faction: "Resistance",
        ship: "T-70 X-Wing",
        skill: 7,
        slots: ['Elite', 'Torpedo', 'Astromech', 'Tech'],
        points: 30
      }, {
        name: '"Red Ace"',
        id: 186,
        unique: true,
        faction: "Resistance",
        ship: "T-70 X-Wing",
        skill: 6,
        slots: ['Torpedo', 'Astromech', 'Tech'],
        points: 29
      }, {
        name: '"Omega Leader"',
        id: 187,
        unique: true,
        faction: "First Order",
        ship: "TIE/fo Fighter",
        skill: 8,
        slots: ['Elite', 'Tech'],
        points: 21
      }, {
        name: '"Zeta Leader"',
        id: 188,
        unique: true,
        faction: "First Order",
        ship: "TIE/fo Fighter",
        skill: 7,
        slots: ['Elite', 'Tech'],
        points: 20
      }, {
        name: '"Epsilon Ace"',
        id: 189,
        unique: true,
        faction: "First Order",
        ship: "TIE/fo Fighter",
        skill: 4,
        slots: ['Tech'],
        points: 17
      }, {
        name: "Tomax Bren",
        id: 190,
        unique: true,
        faction: "Galactic Empire",
        ship: "TIE Bomber",
        skill: 8,
        slots: ['Elite', 'DiscEPT', 'Torpedo', 'Torpedo', 'Missile', 'Missile', 'Bomb'],
        points: 24
      }, {
        name: "Gamma Squadron Veteran",
        id: 191,
        faction: "Galactic Empire",
        ship: "TIE Bomber",
        skill: 5,
        slots: ['Elite', 'Torpedo', 'Torpedo', 'Missile', 'Missile', 'Bomb'],
        points: 19
      }, {
        name: '"Deathfire"',
        id: 192,
        unique: true,
        faction: "Galactic Empire",
        ship: "TIE Bomber",
        skill: 3,
        slots: ['Torpedo', 'Torpedo', 'Missile', 'Missile', 'Bomb'],
        points: 17
      }, {
        name: "Maarek Stele (TIE Defender)",
        canonical_name: 'maarekstele',
        id: 193,
        unique: true,
        faction: "Galactic Empire",
        ship: "TIE Defender",
        skill: 7,
        slots: ['Elite', 'Cannon', 'Missile'],
        points: 35
      }, {
        name: "Glaive Squadron Pilot",
        id: 194,
        faction: "Galactic Empire",
        ship: "TIE Defender",
        skill: 6,
        slots: ['Elite', 'Cannon', 'Missile'],
        points: 34
      }, {
        name: "Countess Ryad",
        id: 195,
        unique: true,
        faction: "Galactic Empire",
        ship: "TIE Defender",
        skill: 5,
        slots: ['Elite', 'Cannon', 'Missile'],
        points: 34
      }, {
        name: "Poe Dameron (PS9)",
        canonical_name: "poedameron-swx57",
        id: 196,
        unique: true,
        faction: "Resistance",
        ship: "T-70 X-Wing",
        skill: 9,
        slots: ['Elite', 'Torpedo', 'Astromech', 'Tech'],
        points: 33
      }, {
        name: 'Nien Nunb',
        id: 197,
        unique: true,
        faction: "Resistance",
        ship: "T-70 X-Wing",
        skill: 7,
        slots: ['Elite', 'Torpedo', 'Astromech', 'Tech'],
        points: 29
      }, {
        name: '"Snap" Wexley',
        id: 198,
        unique: true,
        faction: "Resistance",
        ship: "T-70 X-Wing",
        skill: 6,
        slots: ['Elite', 'Torpedo', 'Astromech', 'Tech'],
        points: 28
      }, {
        name: 'Jess Pava',
        id: 199,
        unique: true,
        faction: "Resistance",
        ship: "T-70 X-Wing",
        skill: 3,
        slots: ['Torpedo', 'Astromech', 'Tech'],
        points: 25
      }, {
        name: "Han Solo (TFA)",
        canonical_name: "hansolo-swx57",
        id: 200,
        unique: true,
        faction: "Resistance",
        ship: "YT-1300",
        skill: 9,
        points: 46,
        slots: ["Elite", "Missile", "Crew", "Crew"],
        ship_override: {
          attack: 3,
          agility: 1,
          hull: 8,
          shields: 5
        }
      }, {
        name: "Rey",
        id: 201,
        unique: true,
        faction: "Resistance",
        ship: "YT-1300",
        skill: 8,
        points: 45,
        slots: ["Elite", "Missile", "Crew", "Crew"],
        ship_override: {
          attack: 3,
          agility: 1,
          hull: 8,
          shields: 5
        }
      }, {
        name: "Chewbacca (TFA)",
        canonical_name: "chewbacca-swx57",
        id: 202,
        unique: true,
        faction: "Resistance",
        ship: "YT-1300",
        skill: 5,
        points: 42,
        slots: ["Elite", "Missile", "Crew", "Crew"],
        ship_override: {
          attack: 3,
          agility: 1,
          hull: 8,
          shields: 5
        }
      }, {
        name: "Resistance Sympathizer",
        id: 203,
        faction: "Resistance",
        ship: "YT-1300",
        skill: 3,
        points: 38,
        slots: ["Missile", "Crew", "Crew"],
        ship_override: {
          attack: 3,
          agility: 1,
          hull: 8,
          shields: 5
        }
      }, {
        name: 'Norra Wexley',
        id: 204,
        unique: true,
        faction: 'Rebel Alliance',
        ship: 'ARC-170',
        skill: 7,
        slots: ['Elite', 'Torpedo', 'Crew', 'Astromech'],
        points: 29
      }, {
        name: 'Shara Bey',
        id: 205,
        unique: true,
        faction: 'Rebel Alliance',
        ship: 'ARC-170',
        skill: 6,
        slots: ['Elite', 'Torpedo', 'Crew', 'Astromech'],
        points: 28
      }, {
        name: 'Thane Kyrell',
        id: 206,
        unique: true,
        faction: 'Rebel Alliance',
        ship: 'ARC-170',
        skill: 4,
        slots: ['Torpedo', 'Crew', 'Astromech'],
        points: 26
      }, {
        name: 'Braylen Stramm',
        id: 207,
        unique: true,
        faction: 'Rebel Alliance',
        ship: 'ARC-170',
        skill: 3,
        slots: ['Torpedo', 'Crew', 'Astromech'],
        points: 25
      }, {
        name: '"Quickdraw"',
        id: 208,
        unique: true,
        faction: 'Galactic Empire',
        ship: 'TIE/sf Fighter',
        skill: 9,
        slots: ['Elite', 'System', 'Missile', 'Tech'],
        points: 29
      }, {
        name: '"Backdraft"',
        id: 209,
        unique: true,
        faction: 'Galactic Empire',
        ship: 'TIE/sf Fighter',
        skill: 7,
        slots: ['Elite', 'System', 'Missile', 'Tech'],
        points: 27
      }, {
        name: 'Omega Specialist',
        id: 210,
        faction: 'Galactic Empire',
        ship: 'TIE/sf Fighter',
        skill: 5,
        slots: ['Elite', 'System', 'Missile', 'Tech'],
        points: 25
      }, {
        name: 'Zeta Specialist',
        id: 211,
        faction: 'Galactic Empire',
        ship: 'TIE/sf Fighter',
        skill: 3,
        slots: ['System', 'Missile', 'Tech'],
        points: 23
      }, {
        name: 'Fenn Rau',
        id: 212,
        unique: true,
        faction: 'Scum and Villainy',
        ship: 'Protectorate Starfighter',
        skill: 9,
        slots: ['Elite', 'Torpedo'],
        points: 28
      }, {
        name: 'Old Teroch',
        id: 213,
        unique: true,
        faction: 'Scum and Villainy',
        ship: 'Protectorate Starfighter',
        skill: 7,
        slots: ['Elite', 'Torpedo'],
        points: 26
      }, {
        name: 'Kad Solus',
        id: 214,
        unique: true,
        faction: 'Scum and Villainy',
        ship: 'Protectorate Starfighter',
        skill: 6,
        slots: ['Elite', 'Torpedo'],
        points: 25
      }, {
        name: 'Concord Dawn Ace',
        id: 215,
        faction: 'Scum and Villainy',
        ship: 'Protectorate Starfighter',
        skill: 5,
        slots: ['Elite', 'Torpedo'],
        points: 23
      }, {
        name: 'Concord Dawn Veteran',
        id: 216,
        faction: 'Scum and Villainy',
        ship: 'Protectorate Starfighter',
        skill: 3,
        slots: ['Elite', 'Torpedo'],
        points: 22
      }, {
        name: 'Zealous Recruit',
        id: 217,
        faction: 'Scum and Villainy',
        ship: 'Protectorate Starfighter',
        skill: 1,
        slots: ['Torpedo'],
        points: 20
      }, {
        name: 'Ketsu Onyo',
        id: 218,
        unique: true,
        faction: 'Scum and Villainy',
        ship: 'Lancer-class Pursuit Craft',
        skill: 7,
        slots: ['Elite', 'Crew', 'Illicit', 'Illicit'],
        points: 38
      }, {
        name: 'Asajj Ventress',
        id: 219,
        unique: true,
        faction: 'Scum and Villainy',
        ship: 'Lancer-class Pursuit Craft',
        skill: 6,
        slots: ['Elite', 'Crew', 'Illicit', 'Illicit'],
        points: 37
      }, {
        name: 'Sabine Wren (Scum)',
        canonical_name: "sabinewren",
        id: 220,
        unique: true,
        faction: 'Scum and Villainy',
        ship: 'Lancer-class Pursuit Craft',
        skill: 5,
        slots: ['Crew', 'Illicit', 'Illicit'],
        points: 35
      }, {
        name: 'Shadowport Hunter',
        id: 221,
        faction: 'Scum and Villainy',
        ship: 'Lancer-class Pursuit Craft',
        skill: 2,
        slots: ['Crew', 'Illicit', 'Illicit'],
        points: 33
      }, {
        name: 'Ahsoka Tano',
        id: 222,
        unique: true,
        faction: 'Rebel Alliance',
        ship: 'TIE Fighter',
        skill: 7,
        slots: ['Elite'],
        points: 17
      }, {
        name: 'Sabine Wren (TIE Fighter)',
        id: 223,
        canonical_name: "sabinewren",
        unique: true,
        faction: 'Rebel Alliance',
        ship: 'TIE Fighter',
        skill: 5,
        slots: ['Elite'],
        points: 15
      }, {
        name: 'Captain Rex',
        id: 224,
        unique: true,
        faction: 'Rebel Alliance',
        ship: 'TIE Fighter',
        skill: 4,
        slots: [],
        points: 14,
        applies_condition: 'Suppressive Fire'.canonicalize()
      }, {
        name: '"Zeb" Orrelios (TIE Fighter)',
        id: 225,
        canonical_name: '"Zeb" Orrelios'.canonicalize(),
        unique: true,
        faction: 'Rebel Alliance',
        ship: 'TIE Fighter',
        skill: 3,
        slots: [],
        points: 13
      }, {
        name: 'Kylo Ren',
        id: 226,
        unique: true,
        faction: 'First Order',
        ship: 'Upsilon-class Shuttle',
        skill: 6,
        slots: ['Elite', 'System', 'Crew', 'Crew', 'Tech', 'Tech'],
        points: 34,
        applies_condition: 'I\'ll Show You the Dark Side'.canonicalize()
      }, {
        name: 'Major Stridan',
        id: 227,
        unique: true,
        faction: 'First Order',
        ship: 'Upsilon-class Shuttle',
        skill: 4,
        slots: ['System', 'Crew', 'Crew', 'Tech', 'Tech'],
        points: 32
      }, {
        name: 'Lieutenant Dormitz',
        id: 228,
        unique: true,
        faction: 'First Order',
        ship: 'Upsilon-class Shuttle',
        skill: 3,
        slots: ['System', 'Crew', 'Crew', 'Tech', 'Tech'],
        points: 31
      }, {
        name: 'Starkiller Base Pilot',
        id: 229,
        faction: 'First Order',
        ship: 'Upsilon-class Shuttle',
        skill: 2,
        slots: ['System', 'Crew', 'Crew', 'Tech', 'Tech'],
        points: 30
      }, {
        name: 'Constable Zuvio',
        id: 230,
        unique: true,
        faction: 'Scum and Villainy',
        ship: 'Quadjumper',
        skill: 7,
        slots: ['Elite', 'Crew', 'Bomb', 'Tech', 'Illicit'],
        points: 19
      }, {
        name: 'Sarco Plank',
        id: 231,
        unique: true,
        faction: 'Scum and Villainy',
        ship: 'Quadjumper',
        skill: 5,
        slots: ['Elite', 'Crew', 'Bomb', 'Tech', 'Illicit'],
        points: 18
      }, {
        name: 'Unkar Plutt',
        id: 232,
        unique: true,
        faction: 'Scum and Villainy',
        ship: 'Quadjumper',
        skill: 3,
        slots: ['Crew', 'Bomb', 'Tech', 'Illicit'],
        points: 17
      }, {
        name: 'Jakku Gunrunner',
        id: 233,
        faction: 'Scum and Villainy',
        ship: 'Quadjumper',
        skill: 1,
        slots: ['Crew', 'Bomb', 'Tech', 'Illicit'],
        points: 15
      }, {
        name: 'Cassian Andor',
        id: 234,
        unique: true,
        faction: 'Rebel Alliance',
        ship: 'U-Wing',
        skill: 6,
        slots: ['Elite', 'System', 'Torpedo', 'Crew', 'Crew'],
        points: 27
      }, {
        name: 'Bodhi Rook',
        id: 235,
        unique: true,
        faction: 'Rebel Alliance',
        ship: 'U-Wing',
        skill: 4,
        slots: ['System', 'Torpedo', 'Crew', 'Crew'],
        points: 25
      }, {
        name: 'Heff Tobber',
        id: 236,
        unique: true,
        faction: 'Rebel Alliance',
        ship: 'U-Wing',
        skill: 3,
        slots: ['System', 'Torpedo', 'Crew', 'Crew'],
        points: 24
      }, {
        name: 'Blue Squadron Pathfinder',
        id: 237,
        faction: 'Rebel Alliance',
        ship: 'U-Wing',
        skill: 2,
        slots: ['System', 'Torpedo', 'Crew', 'Crew'],
        points: 23
      }, {
        name: '"Duchess"',
        id: 238,
        unique: true,
        faction: 'Galactic Empire',
        ship: 'TIE Striker',
        skill: 8,
        slots: ['Elite'],
        points: 23
      }, {
        name: '"Pure Sabacc"',
        id: 239,
        unique: true,
        faction: 'Galactic Empire',
        ship: 'TIE Striker',
        skill: 6,
        slots: ['Elite'],
        points: 22
      }, {
        name: '"Countdown"',
        id: 240,
        unique: true,
        faction: 'Galactic Empire',
        ship: 'TIE Striker',
        skill: 5,
        slots: [],
        points: 20
      }, {
        name: 'Black Squadron Scout',
        id: 241,
        faction: 'Galactic Empire',
        ship: 'TIE Striker',
        skill: 4,
        slots: ['Elite'],
        points: 20
      }, {
        name: 'Scarif Defender',
        id: 242,
        faction: 'Galactic Empire',
        ship: 'TIE Striker',
        skill: 3,
        slots: [],
        points: 18
      }, {
        name: 'Imperial Trainee',
        id: 243,
        faction: 'Galactic Empire',
        ship: 'TIE Striker',
        skill: 1,
        slots: [],
        points: 17
      }, {
        name: 'C-ROC Cruiser',
        id: 244,
        faction: 'Scum and Villainy',
        ship: 'C-ROC Cruiser',
        skill: 1,
        slots: ['Crew', 'Crew', 'Hardpoint', 'Team', 'Cargo', 'Cargo', 'Cargo'],
        points: 35
      }, {
        name: 'Genesis Red',
        id: 245,
        unique: true,
        faction: 'Scum and Villainy',
        ship: 'M3-A Interceptor',
        skill: 7,
        slots: ['Elite'],
        points: 19
      }, {
        name: 'Quinn Jast',
        id: 246,
        unique: true,
        faction: 'Scum and Villainy',
        ship: 'M3-A Interceptor',
        skill: 6,
        slots: ['Elite'],
        points: 18
      }, {
        name: 'Inaldra',
        id: 247,
        unique: true,
        faction: 'Scum and Villainy',
        ship: 'M3-A Interceptor',
        skill: 3,
        slots: ['Elite'],
        points: 15
      }, {
        name: 'Sunny Bounder',
        id: 248,
        unique: true,
        faction: 'Scum and Villainy',
        ship: 'M3-A Interceptor',
        skill: 1,
        slots: [],
        points: 14
      }, {
        name: 'Kashyyyk Defender',
        id: 249,
        faction: 'Rebel Alliance',
        ship: 'Auzituck Gunship',
        skill: 1,
        slots: ['Crew', 'Crew'],
        points: 24
      }, {
        name: 'Wookiee Liberator',
        id: 250,
        faction: 'Rebel Alliance',
        ship: 'Auzituck Gunship',
        skill: 3,
        slots: ['Elite', 'Crew', 'Crew'],
        points: 26
      }, {
        name: 'Lowhhrick',
        id: 251,
        unique: true,
        faction: 'Rebel Alliance',
        ship: 'Auzituck Gunship',
        skill: 5,
        slots: ['Elite', 'Crew', 'Crew'],
        points: 28
      }, {
        name: 'Wullffwarro',
        id: 252,
        faction: 'Rebel Alliance',
        unique: true,
        ship: 'Auzituck Gunship',
        skill: 7,
        slots: ['Elite', 'Crew', 'Crew'],
        points: 30
      }, {
        name: 'Captain Nym (Scum)',
        id: 253,
        canonical_name: 'Captain Nym'.canonicalize(),
        unique: true,
        faction: 'Scum and Villainy',
        ship: 'Scurrg H-6 Bomber',
        skill: 8,
        slots: ['Elite', 'Turret', 'Torpedo', 'Missile', 'Crew', 'Bomb', 'Bomb'],
        points: 30
      }, {
        name: 'Captain Nym (Rebel)',
        id: 254,
        canonical_name: 'Captain Nym'.canonicalize(),
        unique: true,
        faction: 'Rebel Alliance',
        ship: 'Scurrg H-6 Bomber',
        skill: 8,
        slots: ['Elite', 'Turret', 'Torpedo', 'Missile', 'Crew', 'Bomb', 'Bomb'],
        points: 30
      }, {
        name: 'Sol Sixxa',
        id: 255,
        faction: 'Scum and Villainy',
        unique: true,
        ship: 'Scurrg H-6 Bomber',
        skill: 6,
        slots: ['Elite', 'Turret', 'Torpedo', 'Missile', 'Crew', 'Bomb', 'Bomb'],
        points: 28
      }, {
        name: 'Lok Revenant',
        id: 256,
        faction: 'Scum and Villainy',
        ship: 'Scurrg H-6 Bomber',
        skill: 3,
        slots: ['Elite', 'Turret', 'Torpedo', 'Missile', 'Crew', 'Bomb', 'Bomb'],
        points: 26
      }, {
        name: 'Karthakk Pirate',
        id: 257,
        faction: 'Scum and Villainy',
        ship: 'Scurrg H-6 Bomber',
        skill: 1,
        slots: ['Turret', 'Torpedo', 'Missile', 'Crew', 'Bomb', 'Bomb'],
        points: 24
      }, {
        name: 'Sienar Specialist',
        id: 258,
        faction: 'Galactic Empire',
        ship: 'TIE Aggressor',
        skill: 2,
        slots: ['Turret', 'Missile', 'Missile'],
        points: 17
      }, {
        name: 'Onyx Squadron Escort',
        id: 259,
        faction: 'Galactic Empire',
        ship: 'TIE Aggressor',
        skill: 5,
        slots: ['Turret', 'Missile', 'Missile'],
        points: 19
      }, {
        name: '"Double Edge"',
        id: 260,
        unique: true,
        faction: 'Galactic Empire',
        ship: 'TIE Aggressor',
        skill: 4,
        slots: ['Elite', 'Turret', 'Missile', 'Missile'],
        points: 19
      }, {
        name: 'Lieutenant Kestal',
        id: 261,
        unique: true,
        faction: 'Galactic Empire',
        ship: 'TIE Aggressor',
        skill: 7,
        slots: ['Elite', 'Turret', 'Missile', 'Missile'],
        points: 22
      }, {
        name: 'Viktor Hel',
        id: 262,
        faction: 'Scum and Villainy',
        unique: true,
        ship: 'Kihraxz Fighter',
        skill: 7,
        slots: ['Elite', 'Missile', 'Illicit'],
        points: 25
      }, {
        name: 'Captain Jostero',
        id: 263,
        skill: 4,
        faction: 'Scum and Villainy',
        unique: true,
        ship: 'Kihraxz Fighter',
        slots: ['Elite', 'Missile', 'Illicit'],
        points: 24
      }, {
        name: 'Dalan Oberos',
        id: 264,
        faction: 'Scum and Villainy',
        unique: true,
        ship: 'StarViper',
        skill: 6,
        slots: ['Elite', 'Torpedo'],
        points: 30
      }, {
        name: 'Thweek',
        id: 265,
        faction: 'Scum and Villainy',
        unique: true,
        ship: 'StarViper',
        skill: 4,
        slots: ['Torpedo'],
        points: 28,
        applies_condition: ['Shadowed'.canonicalize(), 'Mimicked'.canonicalize()]
      }, {
        name: 'Black Sun Assassin',
        id: 266,
        faction: 'Scum and Villainy',
        ship: 'StarViper',
        skill: 5,
        slots: ['Elite', 'Torpedo'],
        points: 28
      }, {
        name: 'Major Vynder',
        id: 267,
        unique: true,
        faction: 'Galactic Empire',
        ship: 'Alpha-class Star Wing',
        skill: 7,
        slots: ['Elite', 'Torpedo', 'Missile'],
        points: 26
      }, {
        name: 'Lieuten???',
        id: 268,
        unique: true,
        faction: 'Galactic Empire',
        ship: 'Alpha-class Star Wing',
        skill: 5,
        slots: ['Torpedo', 'Missile'],
        points: 100
      }, {
        name: 'Rho Squad???',
        id: 269,
        faction: 'Galactic Empire',
        ship: 'Alpha-class Star Wing',
        skill: 4,
        slots: ['Torpedo', 'Missile'],
        points: 100
      }, {
        name: 'Nu Squa???',
        id: 270,
        faction: 'Galactic Empire',
        ship: 'Alpha-class Star Wing',
        skill: 2,
        slots: ['Torpedo', 'Missile'],
        points: 100
      }, {
        name: 'Torani Kulda',
        id: 271,
        unique: true,
        faction: 'Scum and Villainy',
        ship: 'M12-L Kimogila Fighter',
        skill: 8,
        slots: ['Elite', 'Torpedo', 'Missile', 'Salvaged Astromech', 'Illicit'],
        points: 27
      }, {
        name: 'Dal???',
        id: 272,
        unique: true,
        faction: 'Scum and Villainy',
        ship: 'M12-L Kimogila Fighter',
        skill: 7,
        slots: ['Elite', 'Torpedo', 'Missile', 'Salvaged Astromech', 'Illicit'],
        points: 100
      }, {
        name: 'Cartel E???',
        id: 273,
        faction: 'Scum and Villainy',
        ship: 'M12-L Kimogila Fighter',
        skill: 5,
        slots: ['Elite', 'Torpedo', 'Missile', 'Salvaged Astromech', 'Illicit'],
        points: 100
      }, {
        name: 'Carte???',
        id: 274,
        faction: 'Scum and Villainy',
        ship: 'M12-L Kimogila Fighter',
        skill: 3,
        slots: ['Torpedo', 'Missile', 'Salvaged Astromech', 'Illicit'],
        points: 100
      }, {
        name: 'Fenn Rau (Sheathipede)',
        id: 275,
        canonical_name: 'Fenn Rau'.canonicalize(),
        unique: true,
        faction: 'Rebel Alliance',
        ship: 'Sheathipede-class Shuttle',
        skill: 9,
        slots: ['Elite', 'Crew', 'Astromech'],
        points: 20
      }, {
        name: '"Zeb" Orrelios (Sheathipede)',
        id: 276,
        canonical_name: '"Zeb" Orrelios'.canonicalize(),
        unique: true,
        faction: 'Rebel Alliance',
        ship: 'Sheathipede-class Shuttle',
        skill: 3,
        slots: ['Crew', 'Astromech'],
        points: 100
      }, {
        name: 'Ezra Bridger (Sheathipede)',
        id: 277,
        canonical_name: 'Ezra Bridger'.canonicalize(),
        unique: true,
        faction: 'Rebel Alliance',
        ship: 'Sheathipede-class Shuttle',
        skill: 5,
        slots: ['Crew', 'Astromech'],
        points: 100
      }, {
        name: 'A???',
        id: 278,
        faction: 'Rebel Alliance',
        unique: true,
        ship: 'Sheathipede-class Shuttle',
        skill: 1,
        slots: ['Crew', 'Astromech'],
        points: 100
      }, {
        name: 'Crimson Sq???',
        id: 279,
        faction: 'Resistance',
        ship: 'B/SF-17 Bomber',
        skill: 1,
        slots: ['System', 'Bomb', 'Bomb', 'Tech'],
        points: 100
      }, {
        name: '"Crimson ???',
        id: 280,
        faction: 'Resistance',
        unique: true,
        ship: 'B/SF-17 Bomber',
        skill: 4,
        slots: ['System', 'Bomb', 'Bomb', 'Tech'],
        points: 100
      }, {
        name: '"Cobal???',
        id: 281,
        faction: 'Resistance',
        unique: true,
        ship: 'B/SF-17 Bomber',
        skill: 6,
        slots: ['System', 'Bomb', 'Bomb', 'Tech'],
        points: 100
      }, {
        name: '"Crimson Leader"',
        id: 282,
        faction: 'Resistance',
        unique: true,
        ship: 'B/SF-17 Bomber',
        skill: 7,
        slots: ['System', 'Bomb', 'Bomb', 'Tech'],
        points: 29,
        applies_condition: 'Rattled'.canonicalize()
      }, {
        name: 'Sienar-Jae???',
        id: 283,
        faction: 'First Order',
        ship: 'TIE Silencer',
        skill: 4,
        slots: ['System', 'Tech'],
        points: 100
      }, {
        name: 'First Orde???',
        id: 284,
        faction: 'First Order',
        ship: 'TIE Silencer',
        skill: 6,
        slots: ['System', 'Tech'],
        points: 100
      }, {
        name: 'Test Pilo???',
        id: 285,
        faction: 'First Order',
        unique: true,
        ship: 'TIE Silencer',
        skill: 6,
        slots: ['System', 'Tech'],
        points: 100
      }, {
        name: 'Kylo Ren (TIE Silencer)',
        id: 286,
        canonical_name: 'Kylo Ren'.canonicalize(),
        faction: 'First Order',
        unique: true,
        ship: 'TIE Silencer',
        skill: 9,
        slots: ['Elite', 'System', 'Tech'],
        points: 35,
        applies_condition: 'I\'ll Show You the Dark Side'.canonicalize()
      }
    ],
    upgradesById: [
      {
        name: "Ion Cannon Turret",
        id: 0,
        slot: "Turret",
        points: 5,
        attack: 3,
        range: "1-2"
      }, {
        name: "Proton Torpedoes",
        id: 1,
        slot: "Torpedo",
        points: 4,
        attack: 4,
        range: "2-3"
      }, {
        name: "R2 Astromech",
        id: 2,
        slot: "Astromech",
        points: 1,
        modifier_func: function(stats) {
          var turn, _i, _ref, _results;
          if ((stats.maneuvers != null) && stats.maneuvers.length > 0) {
            _results = [];
            for (turn = _i = 0, _ref = stats.maneuvers[1].length; 0 <= _ref ? _i < _ref : _i > _ref; turn = 0 <= _ref ? ++_i : --_i) {
              if (stats.maneuvers[1][turn] > 0) {
                stats.maneuvers[1][turn] = 2;
              }
              if (stats.maneuvers[2][turn] > 0) {
                _results.push(stats.maneuvers[2][turn] = 2);
              } else {
                _results.push(void 0);
              }
            }
            return _results;
          }
        }
      }, {
        name: "R2-D2",
        aka: ["R2-D2 (Crew)"],
        canonical_name: 'r2d2',
        id: 3,
        unique: true,
        slot: "Astromech",
        points: 4
      }, {
        name: "R2-F2",
        id: 4,
        unique: true,
        slot: "Astromech",
        points: 3
      }, {
        name: "R5-D8",
        id: 5,
        unique: true,
        slot: "Astromech",
        points: 3
      }, {
        name: "R5-K6",
        id: 6,
        unique: true,
        slot: "Astromech",
        points: 2
      }, {
        name: "R5 Astromech",
        id: 7,
        slot: "Astromech",
        points: 1
      }, {
        name: "Determination",
        id: 8,
        slot: "Disabled",
        points: 1
      }, {
        name: "Swarm Tactics",
        id: 9,
        slot: "Disabled",
        points: 2
      }, {
        name: "Squad Leader",
        id: 10,
        unique: true,
        slot: "ActEPT",
        points: 2
      }, {
        name: "Expert Handling",
        id: 11,
        slot: "ActEPT",
        points: 2
      }, {
        name: "Marksmanship",
        id: 12,
        slot: "ActEPT",
        points: 3
      }, {
        name: "Concussion Missiles",
        id: 13,
        slot: "Missile",
        points: 4,
        attack: 4,
        range: "2-3"
      }, {
        name: "Cluster Missiles",
        id: 14,
        slot: "Missile",
        points: 4,
        attack: 3,
        range: "1-2"
      }, {
        name: "Daredevil",
        id: 15,
        slot: "ActEPT",
        points: 3
      }, {
        name: "Elusiveness",
        id: 16,
        slot: "Disabled",
        points: 2
      }, {
        name: "Homing Missiles",
        id: 17,
        slot: "Missile",
        attack: 4,
        range: "2-3",
        points: 5
      }, {
        name: "Push the Limit",
        id: 18,
        slot: "Disabled",
        points: 3
      }, {
        name: "Deadeye",
        id: 19,
        slot: "Disabled",
        points: 1,
        restriction_func: function(ship) {
          var _ref, _ref1;
          return !(((_ref = ship.data.large) != null ? _ref : false) || ((_ref1 = ship.data.huge) != null ? _ref1 : false));
        }
      }, {
        name: "Expose",
        id: 20,
        slot: "ActEPT",
        points: 4
      }, {
        name: "Gunner",
        id: 21,
        slot: "Crew",
        points: 5
      }, {
        name: "Ion Cannon",
        id: 22,
        slot: "Cannon",
        points: 3,
        attack: 3,
        range: "1-3"
      }, {
        name: "Heavy Laser Cannon",
        id: 23,
        slot: "Cannon",
        points: 7,
        attack: 4,
        range: "2-3"
      }, {
        name: "Seismic Charges",
        id: 24,
        slot: "Bomb",
        points: 2
      }, {
        name: "Mercenary Copilot",
        id: 25,
        slot: "Crew",
        points: 2
      }, {
        name: "Assault Missiles",
        id: 26,
        slot: "Missile",
        points: 5,
        attack: 4,
        range: "2-3"
      }, {
        name: "Veteran Instincts",
        id: 27,
        slot: "Disabled",
        points: 1,
        modifier_func: function(stats) {
          return stats.skill += 2;
        }
      }, {
        name: "Proximity Mines",
        id: 28,
        slot: "Bomb",
        points: 3
      }, {
        name: "Weapons Engineer",
        id: 29,
        slot: "Crew",
        points: 3
      }, {
        name: "Draw Their Fire",
        id: 30,
        slot: "Disabled",
        points: 1
      }, {
        name: "Luke Skywalker",
        aka: ["Luke Skywalker."],
        canonical_name: 'lukeskywalker',
        id: 31,
        unique: true,
        faction: "Rebel Alliance",
        slot: "Crew",
        points: 7
      }, {
        name: "Nien Nunb",
        id: 32,
        unique: true,
        faction: "Rebel Alliance",
        slot: "Crew",
        points: 1,
        modifier_func: function(stats) {
          var s, spd, _i, _len, _ref, _ref1, _results;
          _ref1 = (_ref = stats.maneuvers) != null ? _ref : [];
          _results = [];
          for (spd = _i = 0, _len = _ref1.length; _i < _len; spd = ++_i) {
            s = _ref1[spd];
            if (spd === 0) {
              continue;
            }
            if (s[2] > 0) {
              _results.push(s[2] = 2);
            } else {
              _results.push(void 0);
            }
          }
          return _results;
        }
      }, {
        name: "Chewbacca",
        id: 33,
        unique: true,
        faction: "Rebel Alliance",
        slot: "Crew",
        points: 4
      }, {
        name: "Advanced Proton Torpedoes",
        canonical_name: 'Adv. Proton Torpedoes'.canonicalize(),
        id: 34,
        slot: "Torpedo",
        attack: 5,
        range: "1",
        points: 6
      }, {
        name: "Autoblaster",
        id: 35,
        slot: "Cannon",
        attack: 3,
        range: "1",
        points: 5
      }, {
        name: "Fire-Control System",
        id: 36,
        slot: "System",
        points: 2
      }, {
        name: "Blaster Turret",
        id: 37,
        slot: "Turret",
        points: 4,
        attack: 3,
        range: "1-2"
      }, {
        name: "Recon Specialist",
        id: 38,
        slot: "Crew",
        points: 3
      }, {
        name: "Saboteur",
        id: 39,
        slot: "Crew",
        points: 2
      }, {
        name: "Intelligence Agent",
        id: 40,
        slot: "Crew",
        points: 1
      }, {
        name: "Proton Bombs",
        id: 41,
        slot: "Bomb",
        points: 5
      }, {
        name: "Adrenaline Rush",
        id: 42,
        slot: "DiscEPT",
        points: 1
      }, {
        name: "Advanced Sensors",
        id: 43,
        slot: "System",
        points: 3
      }, {
        name: "Sensor Jammer",
        id: 44,
        slot: "System",
        points: 4
      }, {
        name: "Darth Vader",
        id: 45,
        unique: true,
        faction: "Galactic Empire",
        slot: "Crew",
        points: 3
      }, {
        name: "Rebel Captive",
        id: 46,
        unique: true,
        faction: "Galactic Empire",
        slot: "Crew",
        points: 3
      }, {
        name: "Flight Instructor",
        id: 47,
        slot: "Crew",
        points: 4
      }, {
        name: "Navigator",
        id: 48,
        slot: "Crew",
        points: 3,
        epic_restriction_func: function(ship) {
          var _ref;
          return !((_ref = ship.huge) != null ? _ref : false);
        }
      }, {
        name: "Opportunist",
        id: 49,
        slot: "Disabled",
        points: 4
      }, {
        name: "Comms Booster",
        id: 50,
        slot: "Cargo",
        points: 4
      }, {
        name: "Slicer Tools",
        id: 51,
        slot: "Cargo",
        points: 7
      }, {
        name: "Shield Projector",
        id: 52,
        slot: "Cargo",
        points: 4
      }, {
        name: "Ion Pulse Missiles",
        id: 53,
        slot: "Missile",
        points: 3,
        attack: 3,
        range: "2-3"
      }, {
        name: "Wingman",
        id: 54,
        slot: "Disabled",
        points: 2
      }, {
        name: "Decoy",
        id: 55,
        slot: "Disabled",
        points: 2
      }, {
        name: "Outmaneuver",
        id: 56,
        slot: "Disabled",
        points: 3
      }, {
        name: "Predator",
        id: 57,
        slot: "Disabled",
        points: 3
      }, {
        name: "Flechette Torpedoes",
        id: 58,
        slot: "Torpedo",
        points: 2,
        attack: 3,
        range: "2-3"
      }, {
        name: "R7 Astromech",
        id: 59,
        slot: "Astromech",
        points: 2
      }, {
        name: "R7-T1",
        id: 60,
        unique: true,
        slot: "Astromech",
        points: 3
      }, {
        name: "Tactician",
        id: 61,
        slot: "Crew",
        points: 2,
        limited: true
      }, {
        name: "R2-D2 (Crew)",
        aka: ["R2-D2"],
        canonical_name: 'r2d2-swx22',
        id: 62,
        unique: true,
        slot: "Crew",
        points: 4,
        faction: "Rebel Alliance"
      }, {
        name: "C-3PO",
        unique: true,
        id: 63,
        slot: "Crew",
        points: 3,
        faction: "Rebel Alliance"
      }, {
        name: "Single Turbolasers",
        id: 64,
        slot: "Hardpoint",
        points: 8,
        energy: 2,
        attack: 4,
        range: "3-5"
      }, {
        name: "Quad Laser Cannons",
        id: 65,
        slot: "Hardpoint",
        points: 6,
        energy: 2,
        attack: 3,
        range: "1-2"
      }, {
        name: "Tibanna Gas Supplies",
        id: 66,
        slot: "Cargo",
        points: 4,
        limited: true
      }, {
        name: "Ionization Reactor",
        id: 67,
        slot: "Cargo",
        points: 4,
        energy: 5,
        limited: true
      }, {
        name: "Engine Booster",
        id: 68,
        slot: "Cargo",
        points: 3,
        limited: true
      }, {
        name: "R3-A2",
        id: 69,
        unique: true,
        slot: "Astromech",
        points: 2
      }, {
        name: "R2-D6",
        id: 70,
        unique: true,
        slot: "Astromech",
        points: 1,
        restriction_func: function(ship) {
          var conferred_addon, upgrade, _i, _j, _len, _len1, _ref, _ref1, _ref2;
          if (ship.effectiveStats().skill <= 2 || __indexOf.call(ship.pilot.slots, 'Elite') >= 0) {
            return false;
          }
          _ref = ship.upgrades;
          for (_i = 0, _len = _ref.length; _i < _len; _i++) {
            upgrade = _ref[_i];
            if ((upgrade != null) && ((_ref1 = upgrade.data) != null ? _ref1.name : void 0) !== 'R2-D6') {
              _ref2 = upgrade.conferredAddons;
              for (_j = 0, _len1 = _ref2.length; _j < _len1; _j++) {
                conferred_addon = _ref2[_j];
                if (conferred_addon.slot === 'Elite') {
                  return false;
                }
              }
            }
          }
          return true;
        },
        confersAddons: [
          {
            type: exportObj.Upgrade,
            slot: "Elite"
          }
        ]
      }, {
        name: "Enhanced Scopes",
        id: 71,
        slot: "System",
        points: 1
      }, {
        name: "Chardaan Refit",
        id: 72,
        slot: "Missile",
        points: -2,
        ship: "A-Wing"
      }, {
        name: "Proton Rockets",
        id: 73,
        slot: "Missile",
        points: 3,
        attack: 2,
        range: "1"
      }, {
        name: "Kyle Katarn",
        id: 74,
        unique: true,
        slot: "Crew",
        points: 3,
        faction: "Rebel Alliance"
      }, {
        name: "Jan Ors",
        id: 75,
        unique: true,
        slot: "Crew",
        points: 2,
        faction: "Rebel Alliance"
      }, {
        name: "Toryn Farr",
        id: 76,
        unique: true,
        slot: "Crew",
        points: 6,
        faction: "Rebel Alliance",
        restriction_func: exportObj.hugeOnly
      }, {
        name: "R4-D6",
        id: 77,
        unique: true,
        slot: "Astromech",
        points: 1
      }, {
        name: "R5-P9",
        id: 78,
        unique: true,
        slot: "Astromech",
        points: 3
      }, {
        name: "WED-15 Repair Droid",
        id: 79,
        slot: "Crew",
        points: 2,
        restriction_func: exportObj.hugeOnly
      }, {
        name: "Carlist Rieekan",
        id: 80,
        unique: true,
        slot: "Crew",
        points: 3,
        faction: "Rebel Alliance",
        restriction_func: exportObj.hugeOnly
      }, {
        name: "Jan Dodonna",
        id: 81,
        unique: true,
        slot: "Crew",
        points: 6,
        faction: "Rebel Alliance",
        restriction_func: exportObj.hugeOnly
      }, {
        name: "Expanded Cargo Hold",
        id: 82,
        slot: "Cargo",
        points: 1,
        ship: "GR-75 Medium Transport"
      }, {
        name: "Backup Shield Generator",
        id: 83,
        slot: "Cargo",
        limited: true,
        points: 3
      }, {
        name: "EM Emitter",
        id: 84,
        slot: "Cargo",
        limited: true,
        points: 3
      }, {
        name: "Frequency Jammer",
        id: 85,
        slot: "Cargo",
        limited: true,
        points: 4
      }, {
        name: "Han Solo",
        id: 86,
        slot: "Crew",
        unique: true,
        faction: "Rebel Alliance",
        points: 2
      }, {
        name: "Leia Organa",
        id: 87,
        slot: "Crew",
        unique: true,
        faction: "Rebel Alliance",
        points: 4
      }, {
        name: "Targeting Coordinator",
        id: 88,
        slot: "Crew",
        limited: true,
        points: 4
      }, {
        name: "Raymus Antilles",
        id: 89,
        slot: "Crew",
        unique: true,
        faction: "Rebel Alliance",
        points: 6,
        restriction_func: exportObj.hugeOnly
      }, {
        name: "Gunnery Team",
        id: 90,
        slot: "Team",
        limited: true,
        points: 4
      }, {
        name: "Sensor Team",
        id: 91,
        slot: "Team",
        points: 4
      }, {
        name: "Engineering Team",
        id: 92,
        slot: "Team",
        limited: true,
        points: 4
      }, {
        name: "Lando Calrissian",
        id: 93,
        slot: "Crew",
        unique: true,
        faction: "Rebel Alliance",
        points: 3
      }, {
        name: "Mara Jade",
        id: 94,
        slot: "Crew",
        unique: true,
        faction: "Galactic Empire",
        points: 3
      }, {
        name: "Fleet Officer",
        id: 95,
        slot: "Crew",
        faction: "Galactic Empire",
        points: 3
      }, {
        name: "Stay On Target",
        id: 96,
        slot: "Disabled",
        points: 2
      }, {
        name: "Dash Rendar",
        id: 97,
        unique: true,
        slot: "Crew",
        points: 2,
        faction: "Rebel Alliance"
      }, {
        name: "Lone Wolf",
        id: 98,
        unique: true,
        slot: "Disabled",
        points: 2
      }, {
        name: '"Leebo"',
        id: 99,
        unique: true,
        slot: "Crew",
        points: 2,
        faction: "Rebel Alliance"
      }, {
        name: "Ruthlessness",
        id: 100,
        slot: "Disabled",
        points: 3,
        faction: "Galactic Empire"
      }, {
        name: "Intimidation",
        id: 101,
        slot: "Disabled",
        points: 2
      }, {
        name: "Ysanne Isard",
        id: 102,
        unique: true,
        slot: "Crew",
        points: 4,
        faction: "Galactic Empire"
      }, {
        name: "Moff Jerjerrod",
        id: 103,
        unique: true,
        slot: "Crew",
        points: 2,
        faction: "Galactic Empire"
      }, {
        name: "Ion Torpedoes",
        id: 104,
        slot: "Torpedo",
        points: 5,
        attack: 4,
        range: "2-3"
      }, {
        name: "Bodyguard",
        id: 105,
        unique: true,
        slot: "Disabled",
        points: 2,
        faction: "Scum and Villainy"
      }, {
        name: "Calculation",
        id: 106,
        slot: "Disabled",
        points: 1
      }, {
        name: "Accuracy Corrector",
        id: 107,
        slot: "System",
        points: 3
      }, {
        name: "Inertial Dampeners",
        id: 108,
        slot: "Illicit",
        points: 1
      }, {
        name: "Flechette Cannon",
        id: 109,
        slot: "Cannon",
        points: 2,
        attack: 3,
        range: "1-3"
      }, {
        name: '"Mangler" Cannon',
        id: 110,
        slot: "Cannon",
        points: 4,
        attack: 3,
        range: "1-3"
      }, {
        name: "Dead Man's Switch",
        id: 111,
        slot: "Illicit",
        points: 2
      }, {
        name: "Feedback Array",
        id: 112,
        slot: "Illicit",
        points: 2
      }, {
        name: '"Hot Shot" Blaster',
        id: 113,
        slot: "Illicit",
        points: 3,
        attack: 3,
        range: "1-2"
      }, {
        name: "Greedo",
        id: 114,
        unique: true,
        slot: "Crew",
        faction: "Scum and Villainy",
        points: 1
      }, {
        name: "Salvaged Astromech",
        id: 115,
        slot: "Salvaged Astromech",
        points: 2
      }, {
        name: "Bomb Loadout",
        id: 116,
        limited: true,
        slot: "Torpedo",
        points: 0,
        ship: "Y-Wing",
        confersAddons: [
          {
            type: exportObj.Upgrade,
            slot: "Bomb"
          }
        ]
      }, {
        name: '"Genius"',
        id: 117,
        unique: true,
        slot: "Salvaged Astromech",
        points: 0
      }, {
        name: "Unhinged Astromech",
        id: 118,
        slot: "Salvaged Astromech",
        points: 1,
        modifier_func: function(stats) {
          var turn, _i, _ref, _results;
          if ((stats.maneuvers != null) && stats.maneuvers.length > 3) {
            _results = [];
            for (turn = _i = 0, _ref = stats.maneuvers[3].length; 0 <= _ref ? _i < _ref : _i > _ref; turn = 0 <= _ref ? ++_i : --_i) {
              if (stats.maneuvers[3][turn] > 0) {
                _results.push(stats.maneuvers[3][turn] = 2);
              } else {
                _results.push(void 0);
              }
            }
            return _results;
          }
        }
      }, {
        name: "R4-B11",
        id: 119,
        unique: true,
        slot: "Salvaged Astromech",
        points: 3
      }, {
        name: "Autoblaster Turret",
        id: 120,
        slot: "Turret",
        points: 2,
        attack: 2,
        range: "1"
      }, {
        name: "R4 Agromech",
        id: 121,
        slot: "Salvaged Astromech",
        points: 2
      }, {
        name: "K4 Security Droid",
        id: 122,
        slot: "Crew",
        faction: "Scum and Villainy",
        points: 3
      }, {
        name: "Outlaw Tech",
        id: 123,
        limited: true,
        slot: "Crew",
        faction: "Scum and Villainy",
        points: 2
      }, {
        name: 'Advanced Targeting Computer',
        canonical_name: 'Adv. Targeting Computer'.canonicalize(),
        id: 124,
        slot: "System",
        points: 5,
        ship: "TIE Advanced"
      }, {
        name: 'Ion Cannon Battery',
        id: 125,
        slot: "Hardpoint",
        points: 6,
        energy: 2,
        attack: 4,
        range: "2-4"
      }, {
        name: "Extra Munitions",
        id: 126,
        slot: "Torpedo",
        limited: true,
        points: 2
      }, {
        name: "Cluster Mines",
        id: 127,
        slot: "Bomb",
        points: 4
      }, {
        name: 'Glitterstim',
        id: 128,
        slot: "Illicit",
        points: 2
      }, {
        name: 'Grand Moff Tarkin',
        unique: true,
        id: 129,
        slot: "Crew",
        points: 6,
        faction: "Galactic Empire",
        restriction_func: function(ship) {
          var _ref;
          return (_ref = ship.data.huge) != null ? _ref : false;
        }
      }, {
        name: 'Captain Needa',
        unique: true,
        id: 130,
        slot: "Crew",
        points: 2,
        faction: "Galactic Empire",
        restriction_func: function(ship) {
          var _ref;
          return (_ref = ship.data.huge) != null ? _ref : false;
        }
      }, {
        name: 'Admiral Ozzel',
        unique: true,
        id: 131,
        slot: "Crew",
        points: 2,
        faction: "Galactic Empire",
        restriction_func: function(ship) {
          var _ref;
          return (_ref = ship.data.huge) != null ? _ref : false;
        }
      }, {
        name: 'Emperor Palpatine',
        unique: true,
        id: 132,
        slot: "Crew",
        points: 8,
        faction: "Galactic Empire",
        restriction_func: function(ship, upgrade_obj) {
          return ship.hasAnotherUnoccupiedSlotLike(upgrade_obj);
        },
        validation_func: function(ship, upgrade_obj) {
          return upgrade_obj.occupiesAnotherUpgradeSlot();
        },
        also_occupies_upgrades: ["Crew"]
      }, {
        name: 'Bossk',
        unique: true,
        id: 133,
        faction: "Scum and Villainy",
        slot: "Crew",
        points: 2
      }, {
        name: "Lightning Reflexes",
        id: 134,
        slot: "DiscEPT",
        points: 1,
        restriction_func: function(ship) {
          var _ref, _ref1;
          return !(((_ref = ship.data.large) != null ? _ref : false) || ((_ref1 = ship.data.huge) != null ? _ref1 : false));
        }
      }, {
        name: "Twin Laser Turret",
        id: 135,
        slot: "Turret",
        points: 6,
        attack: 3,
        range: "2-3"
      }, {
        name: "Plasma Torpedoes",
        id: 136,
        slot: "Torpedo",
        points: 3,
        attack: 4,
        range: "2-3"
      }, {
        name: "Ion Bombs",
        id: 137,
        slot: "Bomb",
        points: 2
      }, {
        name: "Conner Net",
        id: 138,
        slot: "Bomb",
        points: 4
      }, {
        name: "Bombardier",
        id: 139,
        slot: "Crew",
        points: 1
      }, {
        name: 'Crack Shot',
        id: 140,
        slot: "DiscEPT",
        points: 1
      }, {
        name: "Advanced Homing Missiles",
        canonical_name: 'Adv. Homing Missiles'.canonicalize(),
        id: 141,
        slot: "Missile",
        points: 3,
        attack: 3,
        range: "2"
      }, {
        name: 'Agent Kallus',
        id: 142,
        unique: true,
        points: 2,
        slot: 'Crew',
        faction: 'Galactic Empire'
      }, {
        name: 'XX-23 S-Thread Tracers',
        id: 143,
        points: 1,
        slot: 'Missile',
        attack: 3,
        range: '1-3'
      }, {
        name: "Tractor Beam",
        id: 144,
        slot: "Cannon",
        attack: 3,
        range: "1-3",
        points: 1
      }, {
        name: "Cloaking Device",
        id: 145,
        unique: true,
        slot: "Illicit",
        points: 2,
        restriction_func: function(ship) {
          var _ref, _ref1;
          return !(((_ref = ship.data.large) != null ? _ref : false) || ((_ref1 = ship.data.huge) != null ? _ref1 : false));
        }
      }, {
        name: 'Shield Technician',
        id: 146,
        slot: "Crew",
        points: 1,
        restriction_func: function(ship) {
          var _ref;
          return (_ref = ship.data.huge) != null ? _ref : false;
        }
      }, {
        name: 'Weapons Guidance',
        id: 147,
        slot: "Tech",
        points: 2
      }, {
        name: 'BB-8',
        id: 148,
        unique: true,
        slot: "Astromech",
        points: 2
      }, {
        name: 'R5-X3',
        id: 149,
        unique: true,
        slot: "Astromech",
        points: 1
      }, {
        name: 'Wired',
        id: 150,
        slot: "Disabled",
        points: 1
      }, {
        name: 'Cool Hand',
        id: 151,
        slot: "DiscEPT",
        points: 1
      }, {
        name: 'Juke',
        id: 152,
        slot: "Disabled",
        points: 2,
        restriction_func: function(ship) {
          var _ref, _ref1;
          return !(((_ref = ship.data.large) != null ? _ref : false) || ((_ref1 = ship.data.huge) != null ? _ref1 : false));
        }
      }, {
        name: 'Comm Relay',
        id: 153,
        slot: 'Tech',
        points: 3
      }, {
        name: 'Dual Laser Turret',
        id: 154,
        points: 5,
        slot: 'Hardpoint',
        attack: 3,
        range: '1-3',
        energy: 1,
        ship: 'Gozanti-class Cruiser'
      }, {
        name: 'Broadcast Array',
        id: 155,
        ship: 'Gozanti-class Cruiser',
        points: 2,
        slot: 'Cargo',
        modifier_func: function(stats) {
          if (__indexOf.call(stats.actions, 'Jam') < 0) {
            return stats.actions.push('Jam');
          }
        }
      }, {
        name: 'Rear Admiral Chiraneau',
        id: 156,
        unique: true,
        points: 3,
        slot: 'Crew',
        faction: 'Galactic Empire',
        restriction_func: function(ship) {
          var _ref;
          return (_ref = ship.data.huge) != null ? _ref : false;
        }
      }, {
        name: 'Ordnance Experts',
        id: 157,
        limited: true,
        points: 5,
        slot: 'Team'
      }, {
        name: 'Docking Clamps',
        id: 158,
        points: 0,
        limited: true,
        slot: 'Cargo',
        ship: 'Gozanti-class Cruiser'
      }, {
        name: 'Kanan Jarrus',
        id: 159,
        unique: true,
        faction: 'Rebel Alliance',
        points: 3,
        slot: 'Crew'
      }, {
        name: '"Zeb" Orrelios',
        id: 160,
        unique: true,
        faction: 'Rebel Alliance',
        points: 1,
        slot: 'Crew'
      }, {
        name: 'Reinforced Deflectors',
        id: 161,
        points: 3,
        slot: 'System',
        restriction_func: function(ship) {
          var _ref;
          return (_ref = ship.data.large) != null ? _ref : false;
        }
      }, {
        name: 'Dorsal Turret',
        id: 162,
        points: 3,
        slot: 'Turret',
        attack: 2,
        range: '1-2'
      }, {
        name: 'Targeting Astromech',
        id: 163,
        slot: 'Astromech',
        points: 2
      }, {
        name: 'Hera Syndulla',
        id: 164,
        unique: true,
        faction: 'Rebel Alliance',
        points: 1,
        slot: 'Crew'
      }, {
        name: 'Ezra Bridger',
        id: 165,
        unique: true,
        faction: 'Rebel Alliance',
        points: 3,
        slot: 'Crew'
      }, {
        name: 'Sabine Wren',
        id: 166,
        unique: true,
        faction: 'Rebel Alliance',
        points: 2,
        slot: 'Crew',
        confersAddons: [
          {
            type: exportObj.Upgrade,
            slot: "Bomb"
          }
        ]
      }, {
        name: '"Chopper"',
        id: 167,
        unique: true,
        faction: 'Rebel Alliance',
        points: 0,
        slot: 'Crew'
      }, {
        name: 'Construction Droid',
        id: 168,
        points: 3,
        slot: 'Crew',
        limited: true,
        restriction_func: function(ship) {
          var _ref;
          return (_ref = ship.data.huge) != null ? _ref : false;
        }
      }, {
        name: 'Cluster Bombs',
        id: 169,
        points: 4,
        slot: 'Cargo'
      }, {
        name: "Adaptability",
        id: 170,
        slot: "Disabled",
        points: 0
      }, {
        name: "Adaptability (old)",
        skip: true,
        id: 171,
        superseded_by_id: 170,
        slot: "Disabled",
        points: 0
      }, {
        name: "Electronic Baffle",
        id: 172,
        slot: "System",
        points: 1
      }, {
        name: "4-LOM",
        id: 173,
        unique: true,
        slot: "Crew",
        points: 1,
        faction: "Scum and Villainy"
      }, {
        name: "Zuckuss",
        id: 174,
        unique: true,
        slot: "Crew",
        points: 1,
        faction: "Scum and Villainy"
      }, {
        name: 'Rage',
        id: 175,
        points: 1,
        slot: "ActEPT"
      }, {
        name: "Attanni Mindlink",
        id: 176,
        faction: "Scum and Villainy",
        slot: "Disabled",
        points: 1
      }, {
        name: "Boba Fett",
        id: 177,
        unique: true,
        slot: "Crew",
        points: 1,
        faction: "Scum and Villainy"
      }, {
        name: "Dengar",
        id: 178,
        unique: true,
        slot: "Crew",
        points: 3,
        faction: "Scum and Villainy"
      }, {
        name: '"Gonk"',
        id: 179,
        unique: true,
        slot: "Crew",
        faction: "Scum and Villainy",
        points: 2
      }, {
        name: "R5-P8",
        id: 180,
        unique: true,
        slot: "Salvaged Astromech",
        points: 3
      }, {
        name: 'Thermal Detonators',
        id: 181,
        points: 3,
        slot: 'Bomb'
      }, {
        name: "Overclocked R4",
        id: 182,
        slot: "Salvaged Astromech",
        points: 1
      }, {
        name: 'Systems Officer',
        id: 183,
        faction: 'Galactic Empire',
        limited: true,
        points: 2,
        slot: 'Crew'
      }, {
        name: 'Tail Gunner',
        id: 184,
        slot: 'Crew',
        limited: true,
        points: 2
      }, {
        name: 'R3 Astromech',
        id: 185,
        slot: 'Astromech',
        points: 2
      }, {
        name: 'Collision Detector',
        id: 186,
        slot: 'System',
        points: 0
      }, {
        name: 'Sensor Cluster',
        id: 187,
        slot: 'Tech',
        points: 2
      }, {
        name: 'Fearlessness',
        id: 188,
        slot: "Disabled",
        faction: 'Scum and Villainy',
        points: 1
      }, {
        name: 'Ketsu Onyo',
        id: 189,
        slot: 'Crew',
        faction: 'Scum and Villainy',
        unique: true,
        points: 1
      }, {
        name: 'Latts Razzi',
        id: 190,
        slot: 'Crew',
        faction: 'Scum and Villainy',
        unique: true,
        points: 2
      }, {
        name: 'IG-88D',
        id: 191,
        slot: 'Crew',
        faction: 'Scum and Villainy',
        unique: true,
        points: 1
      }, {
        name: 'Rigged Cargo Chute',
        id: 192,
        slot: 'Illicit',
        points: 1,
        restriction_func: function(ship) {
          var _ref;
          return (_ref = ship.data.large) != null ? _ref : false;
        }
      }, {
        name: 'Seismic Torpedo',
        id: 193,
        slot: 'Torpedo',
        points: 2
      }, {
        name: 'Black Market Slicer Tools',
        id: 194,
        slot: 'Illicit',
        points: 1
      }, {
        name: 'Kylo Ren',
        id: 195,
        slot: 'Crew',
        unique: true,
        faction: 'Galactic Empire',
        points: 3,
        applies_condition: 'I\'ll Show You the Dark Side'.canonicalize()
      }, {
        name: 'Unkar Plutt',
        id: 196,
        faction: 'Scum and Villainy',
        slot: 'Crew',
        unique: true,
        points: 1
      }, {
        name: 'A Score to Settle',
        id: 197,
        applies_condition: 'A Debt to Pay'.canonicalize(),
        slot: "Disabled",
        unique: true,
        points: 0
      }, {
        name: 'Jyn Erso',
        id: 198,
        faction: 'Rebel Alliance',
        slot: 'Crew',
        unique: true,
        points: 2
      }, {
        name: 'Cassian Andor',
        id: 199,
        faction: 'Rebel Alliance',
        slot: 'Crew',
        unique: true,
        points: 2
      }, {
        name: 'Finn',
        id: 200,
        faction: 'Rebel Alliance',
        unique: true,
        slot: 'Crew',
        points: 5
      }, {
        name: 'Rey',
        id: 201,
        faction: 'Rebel Alliance',
        unique: true,
        slot: 'Crew',
        points: 2
      }, {
        name: 'Burnout SLAM',
        id: 202,
        slot: 'Illicit',
        points: 1,
        restriction_func: function(ship) {
          var _ref;
          return (_ref = ship.data.large) != null ? _ref : false;
        },
        modifier_func: function(stats) {
          if (__indexOf.call(stats.actions, 'SLAM') < 0) {
            return stats.actions.push('SLAM');
          }
        }
      }, {
        name: 'Primed Thrusters',
        id: 203,
        slot: 'Tech',
        points: 1,
        restriction_func: function(ship) {
          var _ref, _ref1;
          return !(((_ref = ship.data.large) != null ? _ref : false) || ((_ref1 = ship.data.huge) != null ? _ref1 : false));
        }
      }, {
        name: 'Pattern Analyzer',
        id: 204,
        slot: 'Tech',
        points: 2
      }, {
        name: 'Snap Shot',
        id: 205,
        slot: "Disabled",
        points: 2,
        attack: 2,
        range: 1
      }, {
        name: 'M9-G8',
        id: 206,
        slot: 'Astromech',
        unique: true,
        points: 3
      }, {
        name: 'EMP Device',
        id: 207,
        slot: 'Illicit',
        unique: true,
        points: 2
      }, {
        name: 'Captain Rex',
        id: 208,
        slot: 'Crew',
        faction: 'Rebel Alliance',
        unique: true,
        points: 2
      }, {
        name: 'General Hux',
        id: 209,
        slot: 'Crew',
        unique: true,
        faction: 'Galactic Empire',
        points: 5,
        applies_condition: 'Fanatical Devotion'.canonicalize()
      }, {
        name: 'Operations Specialist',
        id: 210,
        slot: 'Crew',
        limited: true,
        points: 3
      }, {
        name: 'Targeting Synchronizer',
        id: 211,
        slot: 'Tech',
        points: 3
      }, {
        name: 'Hyperwave Comm Scanner',
        id: 212,
        slot: 'Tech',
        points: 1
      }, {
        name: 'Hotshot Co-pilot',
        id: 213,
        slot: 'Crew',
        points: 4
      }, {
        name: 'Trick Shot',
        id: 214,
        slot: "Disabled",
        points: 0
      }, {
        name: 'Scavenger Crane',
        id: 215,
        slot: 'Illicit',
        points: 2
      }, {
        name: 'Bodhi Rook',
        id: 216,
        slot: 'Crew',
        unique: true,
        faction: 'Rebel Alliance',
        points: 1
      }, {
        name: 'Baze Malbus',
        id: 217,
        slot: 'Crew',
        unique: true,
        faction: 'Rebel Alliance',
        points: 3
      }, {
        name: 'Inspiring Recruit',
        id: 218,
        slot: 'Crew',
        points: 1
      }, {
        name: 'Swarm Leader',
        id: 219,
        unique: true,
        slot: "Disabled",
        points: 3
      }, {
        name: 'Expertise',
        id: 220,
        slot: "Disabled",
        points: 4
      }, {
        name: 'Bistan',
        id: 221,
        slot: 'Crew',
        unique: true,
        faction: 'Rebel Alliance',
        points: 2
      }, {
        name: 'BoShek',
        id: 222,
        slot: 'Crew',
        unique: true,
        points: 2
      }, {
        name: 'Heavy Laser Turret',
        id: 223,
        ship: 'C-ROC Cruiser',
        slot: 'Hardpoint',
        points: 5,
        energy: 2,
        attack: 4,
        range: '2-3'
      }, {
        name: 'Cikatro Vizago',
        id: 224,
        unique: true,
        faction: 'Scum and Villainy',
        slot: 'Crew',
        points: 0
      }, {
        name: 'Azmorigan',
        id: 225,
        faction: 'Scum and Villainy',
        slot: 'Crew',
        points: 2,
        restriction_func: function(ship) {
          var _ref;
          return (_ref = ship.data.huge) != null ? _ref : false;
        }
      }, {
        name: 'Quick-release Cargo Locks',
        id: 226,
        slot: 'Cargo',
        points: 2,
        restriction_func: function(ship) {
          var _ref;
          return (_ref = ship.data.canonical_name) === 'C-ROC Cruiser'.canonicalize() || _ref === 'GR-75 Medium Transport'.canonicalize();
        }
      }, {
        name: 'Supercharged Power Cells',
        id: 227,
        limited: true,
        slot: 'Cargo',
        points: 3
      }, {
        name: 'ARC Caster',
        id: 228,
        faction: ['Rebel Alliance', 'Scum and Villainy'],
        slot: 'Cannon',
        points: 2,
        attack: 4,
        range: '1'
      }, {
        name: 'Wookiee Commandos',
        id: 229,
        slot: 'Crew',
        faction: 'Rebel Alliance',
        points: 1,
        restriction_func: function(ship, upgrade_obj) {
          return ship.hasAnotherUnoccupiedSlotLike(upgrade_obj);
        },
        validation_func: function(ship, upgrade_obj) {
          return upgrade_obj.occupiesAnotherUpgradeSlot();
        },
        also_occupies_upgrades: ["Crew"]
      }, {
        name: 'Synced Turret',
        id: 230,
        slot: 'Turret',
        points: 4,
        attack: 3,
        range: '1-2'
      }, {
        name: 'Unguided Rockets',
        id: 231,
        slot: 'Missile',
        points: 2,
        attack: 3,
        range: '1-3',
        restriction_func: function(ship, upgrade_obj) {
          return ship.hasAnotherUnoccupiedSlotLike(upgrade_obj);
        },
        validation_func: function(ship, upgrade_obj) {
          return upgrade_obj.occupiesAnotherUpgradeSlot();
        },
        also_occupies_upgrades: ['Missile']
      }, {
        name: 'Intensity',
        id: 232,
        slot: "Disabled",
        points: 2,
        restriction_func: function(ship) {
          var _ref, _ref1;
          return !(((_ref = ship.data.large) != null ? _ref : false) || ((_ref1 = ship.data.huge) != null ? _ref1 : false));
        }
      }, {
        name: 'Jabba the Hutt',
        id: 233,
        unique: true,
        slot: 'Crew',
        points: 5,
        faction: 'Scum and Villainy',
        restriction_func: function(ship, upgrade_obj) {
          return ship.hasAnotherUnoccupiedSlotLike(upgrade_obj);
        },
        validation_func: function(ship, upgrade_obj) {
          return upgrade_obj.occupiesAnotherUpgradeSlot();
        },
        also_occupies_upgrades: ["Crew"]
      }, {
        name: 'IG-RM Thug Droids',
        id: 234,
        slot: 'Team',
        points: 1
      }, {
        name: 'Selflessness',
        id: 235,
        slot: "Disabled",
        unique: true,
        faction: 'Rebel Alliance',
        points: 1,
        restriction_func: function(ship) {
          var _ref, _ref1;
          return !(((_ref = ship.data.large) != null ? _ref : false) || ((_ref1 = ship.data.huge) != null ? _ref1 : false));
        }
      }, {
        name: 'Breach Specialist',
        id: 236,
        slot: 'Crew',
        points: 1
      }, {
        name: 'Bomblet Generator',
        id: 237,
        slot: 'Bomb',
        unique: true,
        points: 3,
        restriction_func: function(ship, upgrade_obj) {
          return ship.hasAnotherUnoccupiedSlotLike(upgrade_obj);
        },
        validation_func: function(ship, upgrade_obj) {
          return upgrade_obj.occupiesAnotherUpgradeSlot();
        },
        also_occupies_upgrades: ["Bomb"]
      }, {
        name: 'Cad Bane',
        id: 238,
        slot: 'Crew',
        faction: 'Scum and Villainy',
        unique: true,
        points: 2,
        confersAddons: [
          {
            type: exportObj.Upgrade,
            slot: "Bomb"
          }
        ]
      }, {
        name: 'Minefield Mapper',
        id: 239,
        slot: 'System',
        points: 0
      }, {
        name: 'R4-E1',
        id: 240,
        slot: 'Salvaged Astromech',
        unique: true,
        points: 1
      }, {
        name: 'Cruise Missiles',
        id: 241,
        slot: 'Missile',
        points: 3,
        attack: 1,
        range: '2-3'
      }, {
        name: 'Ion Dischargers',
        id: 242,
        slot: 'Illicit',
        points: 2
      }, {
        name: 'Harpoon Missiles',
        id: 243,
        slot: 'Missile',
        points: 4,
        attack: 4,
        range: '2-3',
        applies_condition: 'Harpooned!'.canonicalize()
      }, {
        name: 'Ordnance Silos',
        id: 244,
        slot: 'Bomb',
        points: 2,
        ship: 'B/SF-17 Bomber'
      }, {
        name: 'Trajectory Simulator',
        id: 245,
        slot: 'System',
        points: 1
      }, {
        name: '"Night Beast"',
        id: 246,
        unique: true,
        faction: "Galactic Empire",
        slot: "Elite",
        points: 3
      }, {
        name: "Wedge Antilles",
        id: 247,
        unique: true,
        faction: "Rebel Alliance",
        slot: "Elite",
        points: 5
      }, {
        name: "Garven Dreis",
        id: 248,
        unique: true,
        faction: "Rebel Alliance",
        slot: "Elite",
        points: 3
      }, {
        name: 'Horton Salm',
        id: 249,
        unique: true,
        faction: "Rebel Alliance",
        slot: "Elite",
        points: 4
      }, {
        name: '"Dutch" Vander',
        id: 250,
        unique: true,
        faction: "Rebel Alliance",
        slot: "Elite",
        points: 3
      }, {
        name: '"Howlrunner"',
        id: 251,
        unique: true,
        faction: "Galactic Empire",
        slot: "Elite",
        points: 4
      }, {
        name: '"Backstabber"',
        id: 252,
        unique: true,
        faction: "Galactic Empire",
        slot: "Elite",
        points: 3
      }, {
        name: '"Winged Gundark"',
        id: 253,
        unique: true,
        faction: "Galactic Empire",
        slot: "Elite",
        points: 3
      }, {
        name: 'Darth Vader.',
        aka: ["Darth Vader"],
        id: 254,
        unique: true,
        faction: "Galactic Empire",
        slot: "Elite",
        points: 5
      }, {
        name: 'Maarek Stele',
        id: 255,
        unique: true,
        faction: "Galactic Empire",
        slot: "Elite",
        points: 4
      }, {
        name: 'Tycho Celchu',
        id: 256,
        unique: true,
        faction: "Rebel Alliance",
        slot: "Elite",
        points: 4
      }, {
        name: 'Arvel Crynyd',
        id: 257,
        unique: true,
        faction: "Rebel Alliance",
        slot: "Elite",
        points: 3
      }, {
        name: 'Han Solo.',
        aka: ["Han Solo"],
        id: 258,
        unique: true,
        faction: "Rebel Alliance",
        slot: "Elite",
        points: 5
      }, {
        name: 'Lando Calrissian.',
        aka: ["Lando Calrissian"],
        id: 259,
        unique: true,
        faction: "Rebel Alliance",
        slot: "Elite",
        points: 4
      }, {
        name: 'Chewbacca.',
        aka: ["Chewbacca"],
        id: 260,
        unique: true,
        faction: "Rebel Alliance",
        slot: "Elite",
        points: 3
      }, {
        name: 'Soontir Fel',
        id: 261,
        unique: true,
        faction: "Galactic Empire",
        slot: "Elite",
        points: 5
      }, {
        name: 'Turr Phennir',
        id: 262,
        unique: true,
        faction: "Galactic Empire",
        slot: "Elite",
        points: 4
      }, {
        name: '"Fel\'s Wrath"',
        id: 263,
        unique: true,
        faction: "Galactic Empire",
        slot: "Elite",
        points: 3
      }, {
        name: 'Boba Fett.',
        aka: ["Boba Fett"],
        id: 264,
        unique: true,
        faction: "Galactic Empire",
        slot: "Elite",
        points: 4
      }, {
        name: 'Kath Scarlet',
        id: 265,
        unique: true,
        faction: "Galactic Empire",
        slot: "Elite",
        points: 4
      }, {
        name: 'Krassis Trelix',
        id: 266,
        unique: true,
        faction: "Galactic Empire",
        slot: "Elite",
        points: 3
      }, {
        name: 'Ten Numb',
        id: 267,
        unique: true,
        faction: "Rebel Alliance",
        slot: "Elite",
        points: 4
      }, {
        name: 'Ibtisam',
        id: 268,
        unique: true,
        faction: "Rebel Alliance",
        slot: "Elite",
        points: 3
      }, {
        name: 'Jan Ors.',
        aka: ["Jan Ors"],
        id: 269,
        unique: true,
        faction: "Rebel Alliance",
        slot: "Elite",
        points: 4
      }, {
        name: 'Kyle Katarn.',
        aka: ["Kyle Katarn"],
        id: 270,
        unique: true,
        faction: "Rebel Alliance",
        slot: "Elite",
        points: 3
      }, {
        name: 'Roark Garnet',
        id: 271,
        unique: true,
        faction: "Rebel Alliance",
        slot: "Elite",
        points: 2
      }, {
        name: 'Major Rhymer',
        id: 272,
        unique: true,
        faction: "Galactic Empire",
        slot: "Elite",
        points: 4
      }, {
        name: 'Captain Jonus',
        id: 273,
        unique: true,
        faction: "Galactic Empire",
        slot: "Elite",
        points: 3
      }, {
        name: 'Captain Kagi',
        id: 274,
        unique: true,
        faction: "Galactic Empire",
        slot: "Elite",
        points: 4
      }, {
        name: 'Colonel Jendon',
        id: 275,
        unique: true,
        faction: "Galactic Empire",
        slot: "Elite",
        points: 3
      }, {
        name: 'Captain Yorr',
        id: 276,
        unique: true,
        faction: "Galactic Empire",
        slot: "Elite",
        points: 2
      }, {
        name: 'Airen Cracken',
        id: 277,
        unique: true,
        faction: "Rebel Alliance",
        slot: "Elite",
        points: 4
      }, {
        name: 'Lieutenant Blount',
        id: 278,
        unique: true,
        faction: "Rebel Alliance",
        slot: "Elite",
        points: 3
      }, {
        name: 'Corran Horn',
        id: 279,
        unique: true,
        faction: "Rebel Alliance",
        slot: "Elite",
        points: 4
      }, {
        name: "Etahn A'baht",
        id: 280,
        unique: true,
        faction: "Rebel Alliance",
        slot: "Elite",
        points: 3
      }, {
        name: 'Rexler Brath',
        id: 281,
        unique: true,
        faction: "Galactic Empire",
        slot: "Elite",
        points: 4
      }, {
        name: 'Colonel Vessery',
        id: 282,
        unique: true,
        faction: "Galactic Empire",
        slot: "Elite",
        points: 3
      }, {
        name: '"Whisper"',
        id: 283,
        unique: true,
        faction: "Galactic Empire",
        slot: "Elite",
        points: 4
      }, {
        name: '"Echo"',
        id: 284,
        unique: true,
        faction: "Galactic Empire",
        slot: "Elite",
        points: 3
      }, {
        name: 'Dash Rendar.',
        aka: ["Dash Rendar"],
        id: 285,
        unique: true,
        faction: "Rebel Alliance",
        slot: "Elite",
        points: 4
      }, {
        name: 'Eaden Vrill',
        id: 286,
        unique: true,
        faction: "Rebel Alliance",
        slot: "Elite",
        points: 2
      }, {
        name: '"Leebo".',
        aka: ['"Leebo"'],
        id: 287,
        unique: true,
        faction: "Rebel Alliance",
        slot: "Elite",
        points: 3
      }, {
        name: 'Captain Oicunn',
        id: 288,
        unique: true,
        faction: "Galactic Empire",
        slot: "Elite",
        points: 2
      }, {
        name: 'Rear Admiral Chiraneau',
        id: 289,
        unique: true,
        faction: "Galactic Empire",
        slot: "Elite",
        points: 4
      }, {
        name: 'Commander Kenkirk',
        id: 290,
        unique: true,
        faction: "Galactic Empire",
        slot: "Elite",
        points: 3
      }, {
        name: 'Carnor Jax',
        id: 291,
        unique: true,
        faction: "Galactic Empire",
        slot: "Elite",
        points: 4
      }, {
        name: 'Kir Kanos',
        id: 292,
        unique: true,
        faction: "Galactic Empire",
        slot: "Elite",
        points: 3
      }, {
        name: 'Tetran Cowall',
        id: 293,
        unique: true,
        faction: "Galactic Empire",
        slot: "Elite",
        points: 4
      }, {
        name: 'Lieutenant Lorrir',
        id: 294,
        unique: true,
        faction: "Galactic Empire",
        slot: "Elite",
        points: 3
      }, {
        name: 'Wes Janson',
        id: 295,
        unique: true,
        faction: 'Rebel Alliance',
        slot: 'Elite',
        points: 4
      }, {
        name: 'Jek Porkins',
        id: 296,
        unique: true,
        faction: 'Rebel Alliance',
        slot: 'Elite',
        points: 4
      }, {
        name: '"Hobbie" Klivian',
        id: 297,
        unique: true,
        faction: 'Rebel Alliance',
        slot: 'Elite',
        points: 3
      }, {
        name: 'Tarn Mison',
        id: 298,
        unique: true,
        faction: 'Rebel Alliance',
        slot: 'Elite',
        points: 2
      }, {
        name: 'Jake Farrell',
        id: 299,
        unique: true,
        faction: 'Rebel Alliance',
        slot: 'Elite',
        points: 4
      }, {
        name: 'Gemmer Sojan',
        id: 300,
        unique: true,
        faction: 'Rebel Alliance',
        slot: 'Elite',
        points: 3
      }, {
        name: 'Keyan Farlander',
        id: 301,
        unique: true,
        faction: 'Rebel Alliance',
        slot: 'Elite',
        points: 4
      }, {
        name: 'Nera Dantels',
        id: 302,
        unique: true,
        faction: 'Rebel Alliance',
        slot: 'Elite',
        points: 3
      }, {
        name: 'Prince Xizor',
        id: 303,
        unique: true,
        faction: 'Scum and Villainy',
        slot: 'Elite',
        points: 4
      }, {
        name: 'Guri',
        id: 304,
        unique: true,
        faction: 'Scum and Villainy',
        slot: 'Elite',
        points: 3
      }, {
        name: 'Serissu',
        id: 305,
        unique: true,
        faction: 'Scum and Villainy',
        slot: 'Elite',
        points: 4
      }, {
        name: 'Laetin A\'shera',
        id: 306,
        unique: true,
        faction: 'Scum and Villainy',
        slot: 'Elite',
        points: 3
      }, {
        name: 'IG-88A',
        id: 307,
        unique: true,
        faction: 'Scum and Villainy',
        slot: 'Elite',
        points: 3
      }, {
        name: 'IG-88B',
        id: 308,
        unique: true,
        faction: 'Scum and Villainy',
        slot: 'Elite',
        points: 3
      }, {
        name: 'IG-88C',
        id: 309,
        unique: true,
        faction: 'Scum and Villainy',
        slot: 'Elite',
        points: 3
      }, {
        name: 'IG-88D.',
        aka: ['IG-88D'],
        id: 310,
        unique: true,
        faction: 'Scum and Villainy',
        slot: 'Elite',
        points: 3
      }, {
        name: 'N\'Dru Suhlak',
        id: 311,
        unique: true,
        faction: 'Scum and Villainy',
        slot: 'Elite',
        points: 4
      }, {
        name: 'Kaa\'to Leeachos',
        id: 312,
        unique: true,
        faction: 'Scum and Villainy',
        slot: 'Elite',
        points: 3
      }, {
        name: 'Boba Fett (Scum).',
        aka: ['Boba Fett (Scum)'],
        id: 313,
        unique: true,
        faction: 'Scum and Villainy',
        slot: 'Elite',
        points: 4,
        'canonical_name': 'Boba Fett'.canonicalize()
      }, {
        name: 'Kath Scarlet (Scum)',
        id: 314,
        unique: true,
        faction: 'Scum and Villainy',
        slot: 'Elite',
        points: 4,
        'canonical_name': 'Kath Scarlet'.canonicalize()
      }, {
        name: 'Emon Azzameen',
        id: 315,
        unique: true,
        faction: 'Scum and Villainy',
        slot: 'Elite',
        points: 3
      }, {
        name: 'Kavil',
        id: 316,
        unique: true,
        faction: 'Scum and Villainy',
        slot: 'Elite',
        points: 4
      }, {
        name: 'Drea Renthal',
        id: 317,
        unique: true,
        faction: 'Scum and Villainy',
        slot: 'Elite',
        points: 3
      }, {
        name: 'Dace Bonearm',
        id: 318,
        unique: true,
        faction: 'Scum and Villainy',
        slot: 'Elite',
        points: 4
      }, {
        name: 'Palob Godalhi',
        id: 319,
        unique: true,
        faction: 'Scum and Villainy',
        slot: 'Elite',
        points: 3
      }, {
        name: 'Torkil Mux',
        id: 320,
        unique: true,
        faction: 'Scum and Villainy',
        slot: 'Elite',
        points: 2
      }, {
        name: 'Commander Alozen',
        id: 321,
        unique: true,
        faction: 'Galactic Empire',
        slot: 'Elite',
        points: 3
      }, {
        name: 'Bossk.',
        id: 322,
        unique: true,
        faction: 'Scum and Villainy',
        slot: 'Elite',
        points: 4
      }, {
        name: 'Moralo Eval',
        id: 323,
        unique: true,
        faction: 'Scum and Villainy',
        slot: 'Elite',
        points: 3
      }, {
        name: 'Latts Razzi.',
        id: 324,
        unique: true,
        faction: 'Scum and Villainy',
        slot: 'Elite',
        points: 3
      }, {
        name: 'Talonbane Cobra',
        id: 325,
        unique: true,
        faction: 'Scum and Villainy',
        slot: 'Elite',
        points: 5
      }, {
        name: 'Graz the Hunter',
        id: 326,
        unique: true,
        faction: 'Scum and Villainy',
        slot: 'Elite',
        points: 3
      }, {
        name: 'Miranda Doni',
        id: 327,
        unique: true,
        faction: 'Rebel Alliance',
        slot: 'Elite',
        points: 4
      }, {
        name: 'Esege Tuketu',
        id: 328,
        unique: true,
        faction: 'Rebel Alliance',
        slot: 'Elite',
        points: 3
      }, {
        name: '"Redline"',
        id: 329,
        unique: true,
        faction: 'Galactic Empire',
        slot: 'Elite',
        points: 4
      }, {
        name: '"Deathrain"',
        id: 330,
        unique: true,
        faction: 'Galactic Empire',
        slot: 'Elite',
        points: 3
      }, {
        name: 'Juno Eclipse',
        id: 331,
        unique: true,
        faction: 'Galactic Empire',
        slot: 'Elite',
        points: 4
      }, {
        name: 'Zertik Strom',
        id: 332,
        unique: true,
        faction: 'Galactic Empire',
        slot: 'Elite',
        points: 3
      }, {
        name: 'Lieutenant Colzet',
        id: 333,
        unique: true,
        faction: 'Galactic Empire',
        slot: 'Elite',
        points: 2
      }, {
        name: '"Scourge"',
        id: 334,
        unique: true,
        faction: 'Galactic Empire',
        slot: 'Elite',
        points: 4
      }, {
        name: '"Youngster"',
        id: 335,
        unique: true,
        faction: 'Galactic Empire',
        slot: 'Elite',
        points: 3,
        confersAddons: [
          {
            type: exportObj.Upgrade,
            slot: "ActEPT"
          }
        ]
      }, {
        name: '"Wampa"',
        id: 336,
        unique: true,
        faction: 'Galactic Empire',
        slot: 'Elite',
        points: 2
      }, {
        name: '"Chaser"',
        id: 337,
        unique: true,
        faction: 'Galactic Empire',
        slot: 'Elite',
        points: 2
      }, {
        name: 'Hera Syndulla.',
        aka: ['Hera Syndulla'],
        id: 338,
        unique: true,
        faction: 'Rebel Alliance',
        slot: 'Elite',
        points: 4
      }, {
        name: 'Kanan Jarrus.',
        aka: ['Kanan Jarrus'],
        id: 339,
        unique: true,
        faction: 'Rebel Alliance',
        slot: 'Elite',
        points: 3
      }, {
        name: '"Chopper".',
        aka: ['"Chopper"'],
        id: 340,
        unique: true,
        faction: 'Rebel Alliance',
        slot: 'Elite',
        points: 2
      }, {
        name: 'Hera Syndulla (Attack Shuttle)',
        aka: ['Hera Syndulla'],
        id: 341,
        unique: true,
        faction: 'Rebel Alliance',
        slot: 'Disabled',
        points: 4
      }, {
        name: 'Sabine Wren.',
        aka: ['Sabine Wren'],
        id: 342,
        unique: true,
        faction: 'Rebel Alliance',
        slot: 'Elite',
        points: 3
      }, {
        name: 'Ezra Bridger.',
        aka: ['Ezra Bridger'],
        id: 343,
        unique: true,
        faction: 'Rebel Alliance',
        slot: 'Elite',
        points: 2
      }, {
        name: '"Zeb" Orrelios.',
        aka: ['"Zeb" Orrelios'],
        id: 344,
        unique: true,
        faction: 'Rebel Alliance',
        slot: 'Elite',
        points: 2
      }, {
        name: 'The Inquisitor',
        id: 345,
        unique: true,
        faction: 'Galactic Empire',
        slot: 'Elite',
        points: 4
      }, {
        name: 'Valen Rudor',
        id: 346,
        unique: true,
        faction: 'Galactic Empire',
        slot: 'Elite',
        points: 3
      }, {
        name: 'Zuckuss.',
        aka: ['Zuckuss'],
        id: 347,
        unique: true,
        faction: 'Scum and Villainy',
        slot: 'Elite',
        points: 4
      }, {
        name: '4-LOM.',
        aka: ['4-LOM'],
        id: 348,
        unique: true,
        faction: 'Scum and Villainy',
        slot: 'Elite',
        points: 3
      }, {
        name: 'Dengar.',
        aka: ['Dengar'],
        id: 349,
        unique: true,
        faction: 'Scum and Villainy',
        slot: 'Elite',
        points: 5
      }, {
        name: 'Tel Trevura',
        id: 350,
        unique: true,
        faction: 'Scum and Villainy',
        slot: 'Elite',
        points: 4
      }, {
        name: 'Manaroo',
        id: 351,
        unique: true,
        faction: 'Scum and Villainy',
        slot: 'Elite',
        points: 2
      }, {
        name: 'Poe Dameron',
        id: 352,
        unique: true,
        faction: 'Resistance',
        slot: 'Disabled',
        points: 4
      }, {
        name: '"Blue Ace"',
        id: 353,
        unique: true,
        faction: 'Resistance',
        slot: 'Elite',
        points: 3
      }, {
        name: '"Omega Ace"',
        id: 354,
        unique: true,
        faction: 'First Order',
        slot: 'Elite',
        points: 4
      }, {
        name: '"Epsilon Leader"',
        id: 355,
        unique: true,
        faction: 'First Order',
        slot: 'Elite',
        points: 3
      }, {
        name: '"Zeta Ace"',
        id: 356,
        unique: true,
        faction: 'First Order',
        slot: 'Elite',
        points: 3
      }, {
        name: 'Ello Asty',
        id: 357,
        unique: true,
        faction: 'Resistance',
        slot: 'Elite',
        points: 4
      }, {
        name: '"Red Ace"',
        id: 358,
        unique: true,
        faction: 'Resistance',
        slot: 'Elite',
        points: 3
      }, {
        name: '"Omega Leader"',
        id: 359,
        unique: true,
        faction: 'First Order',
        slot: 'Elite',
        points: 4
      }, {
        name: '"Zeta Leader"',
        id: 360,
        unique: true,
        faction: 'First Order',
        slot: 'Elite',
        points: 4
      }, {
        name: '"Epsilon Ace"',
        id: 361,
        unique: true,
        faction: 'First Order',
        slot: 'Elite',
        points: 2
      }, {
        name: 'Tomax Bren',
        id: 362,
        unique: true,
        faction: 'Galactic Empire',
        slot: 'Elite',
        points: 4,
        confersAddons: [
          {
            type: exportObj.Upgrade,
            slot: "DiscEPT"
          }
        ]
      }, {
        name: '"Deathfire"',
        id: 363,
        unique: true,
        faction: 'Galactic Empire',
        slot: 'Elite',
        points: 2
      }, {
        name: 'Maarek Stele (TIE Defender)',
        id: 364,
        unique: true,
        faction: 'Galactic Empire',
        slot: 'Disabled',
        points: 4,
        'canonical_name': 'maarekstele'
      }, {
        name: 'Countess Ryad',
        id: 365,
        unique: true,
        faction: 'Galactic Empire',
        slot: 'Elite',
        points: 3
      }, {
        name: 'Poe Dameron (PS9)',
        aka: ['Poe Dameron'],
        id: 366,
        unique: true,
        faction: 'Resistance',
        slot: 'Elite',
        points: 5,
        'canonical_name': 'poedameron-swx57'
      }, {
        name: 'Nien Nunb.',
        aka: ['Nien Nunb'],
        id: 367,
        unique: true,
        faction: 'Resistance',
        slot: 'Elite',
        points: 4
      }, {
        name: '"Snap" Wexley',
        id: 368,
        unique: true,
        faction: 'Resistance',
        slot: 'Elite',
        points: 3
      }, {
        name: 'Jess Pava',
        id: 369,
        unique: true,
        faction: 'Resistance',
        slot: 'Elite',
        points: 2
      }, {
        name: 'Han Solo (TFA)',
        aka: ['Han Solo'],
        id: 370,
        unique: true,
        faction: 'Resistance',
        slot: 'Elite',
        points: 5,
        'canonical_name': 'hansolo-swx57'
      }, {
        name: 'Rey.',
        aka: ['Rey'],
        id: 371,
        unique: true,
        faction: 'Resistance',
        slot: 'Elite',
        points: 4
      }, {
        name: 'Chewbacca (TFA)',
        aka: ['Chewbacca'],
        id: 372,
        unique: true,
        faction: 'Resistance',
        slot: 'Elite',
        points: 3,
        'canonical_name': 'chewbacca-swx57'
      }, {
        name: 'Norra Wexley',
        id: 373,
        unique: true,
        faction: 'Rebel Alliance',
        slot: 'Elite',
        points: 4
      }, {
        name: 'Shara Bey',
        id: 374,
        unique: true,
        faction: 'Rebel Alliance',
        slot: 'Elite',
        points: 3
      }, {
        name: 'Thane Kyrell',
        id: 375,
        unique: true,
        faction: 'Rebel Alliance',
        slot: 'Elite',
        points: 2
      }, {
        name: 'Braylen Stramm',
        id: 376,
        unique: true,
        faction: 'Rebel Alliance',
        slot: 'Elite',
        points: 2
      }, {
        name: '"Quickdraw"',
        id: 377,
        unique: true,
        faction: 'Galactic Empire',
        slot: 'Elite',
        points: 5
      }, {
        name: '"Backdraft"',
        id: 378,
        unique: true,
        faction: 'Galactic Empire',
        slot: 'Elite',
        points: 4
      }, {
        name: 'Fenn Rau',
        id: 379,
        unique: true,
        faction: 'Scum and Villainy',
        slot: 'Elite',
        points: 5
      }, {
        name: 'Old Teroch',
        id: 380,
        unique: true,
        faction: 'Scum and Villainy',
        slot: 'Elite',
        points: 4
      }, {
        name: 'Kad Solus',
        id: 381,
        unique: true,
        faction: 'Scum and Villainy',
        slot: 'Elite',
        points: 3
      }, {
        name: 'Ketsu Onyo.',
        aka: ['Ketsu Onyo'],
        id: 382,
        unique: true,
        faction: 'Scum and Villainy',
        slot: 'Elite',
        points: 4
      }, {
        name: 'Asajj Ventress',
        id: 383,
        unique: true,
        faction: 'Scum and Villainy',
        slot: 'Elite',
        points: 3
      }, {
        name: 'Sabine Wren (Scum)',
        id: 384,
        unique: true,
        faction: 'Scum and Villainy',
        slot: 'Elite',
        points: 3,
        'canonical_name': 'sabinewren'
      }, {
        name: 'Ahsoka Tano',
        id: 385,
        unique: true,
        faction: 'Rebel Alliance',
        slot: 'Elite',
        points: 4
      }, {
        name: 'Sabine Wren (TIE Fighter)',
        aka: ['Sabine Wren'],
        id: 386,
        unique: true,
        faction: 'Rebel Alliance',
        slot: 'Disabled',
        points: 3,
        'canonical_name': 'sabinewren'
      }, {
        name: 'Captain Rex.',
        aka: ['Captain Rex'],
        id: 387,
        unique: true,
        faction: 'Rebel Alliance',
        slot: 'Elite',
        points: 2,
        applies_condition: 'Suppressive Fire'.canonicalize()
      }, {
        name: '"Zeb" Orrelios (TIE Fighter)',
        aka: ['"Zeb" Orrelios'],
        id: 388,
        unique: true,
        faction: 'Rebel Alliance',
        slot: 'Disabled',
        points: 2,
        'canonical_name': '"Zeb" Orrelios'.canonicalize()
      }, {
        name: 'Kylo Ren.',
        aka: ['Kylo Ren'],
        id: 389,
        unique: true,
        faction: 'First Order',
        slot: 'Elite',
        points: 3,
        applies_condition: 'I\'ll Show You the Dark Side'.canonicalize()
      }, {
        name: 'Major Stridan',
        id: 390,
        unique: true,
        faction: 'First Order',
        slot: 'Elite',
        points: 2
      }, {
        name: 'Lieutenant Dormitz',
        id: 391,
        unique: true,
        faction: 'First Order',
        slot: 'Elite',
        points: 2
      }, {
        name: 'Constable Zuvio',
        id: 392,
        unique: true,
        faction: 'Scum and Villainy',
        slot: 'Elite',
        points: 4
      }, {
        name: 'Sarco Plank',
        id: 393,
        unique: true,
        faction: 'Scum and Villainy',
        slot: 'Elite',
        points: 3
      }, {
        name: 'Unkar Plutt.',
        aka: ['Unkar Plutt'],
        id: 394,
        unique: true,
        faction: 'Scum and Villainy',
        slot: 'Elite',
        points: 2
      }, {
        name: 'Cassian Andor.',
        aka: ['Cassian Andor'],
        id: 395,
        unique: true,
        faction: 'Rebel Alliance',
        slot: 'Elite',
        points: 3
      }, {
        name: 'Bodhi Rook.',
        aka: ['Bodhi Rook'],
        id: 396,
        unique: true,
        faction: 'Rebel Alliance',
        slot: 'Elite',
        points: 2
      }, {
        name: 'Heff Tobber',
        id: 397,
        unique: true,
        faction: 'Rebel Alliance',
        slot: 'Elite',
        points: 2
      }, {
        name: '"Duchess"',
        id: 398,
        unique: true,
        faction: 'Galactic Empire',
        slot: 'Elite',
        points: 4
      }, {
        name: '"Pure Sabacc"',
        id: 399,
        unique: true,
        faction: 'Galactic Empire',
        slot: 'Elite',
        points: 3
      }, {
        name: '"Countdown"',
        id: 400,
        unique: true,
        faction: 'Galactic Empire',
        slot: 'Elite',
        points: 3
      }, {
        name: 'Genesis Red',
        id: 401,
        unique: true,
        faction: 'Scum and Villainy',
        slot: 'Elite',
        points: 4
      }, {
        name: 'Quinn Jast',
        id: 402,
        unique: true,
        faction: 'Scum and Villainy',
        slot: 'Elite',
        points: 3
      }, {
        name: 'Inaldra',
        id: 403,
        unique: true,
        faction: 'Scum and Villainy',
        slot: 'Elite',
        points: 2
      }, {
        name: 'Sunny Bounder',
        id: 404,
        unique: true,
        faction: 'Scum and Villainy',
        slot: 'Elite',
        points: 1
      }, {
        name: 'Lowhhrick',
        id: 405,
        unique: true,
        faction: 'Rebel Alliance',
        slot: 'Elite',
        points: 3
      }, {
        name: 'Wullffwarro',
        id: 406,
        unique: true,
        faction: 'Rebel Alliance',
        slot: 'Elite',
        points: 4
      }, {
        name: 'Captain Nym (Scum)',
        id: 407,
        unique: true,
        faction: 'Scum and Villainy',
        slot: 'Elite',
        points: 4,
        'canonical_name': 'Captain Nym'.canonicalize()
      }, {
        name: 'Captain Nym (Rebel)',
        id: 408,
        unique: true,
        faction: 'Rebel Alliance',
        slot: 'Elite',
        points: 4,
        'canonical_name': 'Captain Nym'.canonicalize()
      }, {
        name: 'Sol Sixxa',
        id: 409,
        unique: true,
        faction: 'Scum and Villainy',
        slot: 'Elite',
        points: 3
      }, {
        name: '"Double Edge"',
        id: 410,
        unique: true,
        faction: 'Galactic Empire',
        slot: 'Elite',
        points: 2
      }, {
        name: 'Lieutenant Kestal',
        id: 411,
        unique: true,
        faction: 'Galactic Empire',
        slot: 'Elite',
        points: 4
      }, {
        name: "Luke Skywalker.",
        aka: ["Luke Skywalker"],
        id: 412,
        unique: true,
        faction: "Rebel Alliance",
        slot: "Elite",
        points: 4
      }, {
        name: "Biggs Darklighter",
        id: 413,
        unique: true,
        faction: "Rebel Alliance",
        slot: "Elite",
        points: 3
      }, {
        name: '"Mauler Mithel"',
        id: 414,
        unique: true,
        faction: "Galactic Empire",
        slot: "Elite",
        points: 4
      }, {
        name: '"Dark Curse"',
        id: 415,
        unique: true,
        faction: "Galactic Empire",
        slot: "Elite",
        points: 3
      }, {
        name: 'Viktor Hel',
        id: 416,
        unique: true,
        faction: 'Scum and Villainy',
        slot: 'Elite',
        points: 4
      }, {
        name: 'Captain Jostero',
        id: 417,
        unique: true,
        faction: 'Scum and Villainy',
        slot: 'Elite',
        points: 2
      }, {
        name: 'Dalan Oberos',
        id: 418,
        unique: true,
        faction: 'Scum and Villainy',
        slot: 'Elite',
        points: 3
      }, {
        name: 'Thweek',
        id: 419,
        unique: true,
        faction: 'Scum and Villainy',
        slot: 'Elite',
        points: 2,
        applies_condition: ['Shadowed'.canonicalize(), 'Mimicked'.canonicalize()]
      }
    ],
    modificationsById: [
      {
        name: "Zero modification",
        id: 0,
        skip: true
      }, {
        name: "Stealth Device",
        id: 1,
        points: 3,
        modifier_func: function(stats) {
          return stats.agility += 1;
        }
      }, {
        name: "Shield Upgrade",
        id: 2,
        points: 4,
        modifier_func: function(stats) {
          return stats.shields += 1;
        }
      }, {
        name: "Engine Upgrade",
        id: 3,
        points: 4,
        modifier_func: function(stats) {
          if (__indexOf.call(stats.actions, 'Boost') < 0) {
            return stats.actions.push('Boost');
          }
        }
      }, {
        name: "Anti-Pursuit Lasers",
        id: 4,
        points: 2,
        restriction_func: function(ship) {
          var _ref;
          return (_ref = ship.data.large) != null ? _ref : false;
        }
      }, {
        name: "Targeting Computer",
        id: 5,
        points: 2,
        modifier_func: function(stats) {
          if (__indexOf.call(stats.actions, 'Target Lock') < 0) {
            return stats.actions.push('Target Lock');
          }
        }
      }, {
        name: "Hull Upgrade",
        id: 6,
        points: 3,
        modifier_func: function(stats) {
          return stats.hull += 1;
        }
      }, {
        name: "Munitions Failsafe",
        id: 7,
        points: 1
      }, {
        name: "Stygium Particle Accelerator",
        id: 8,
        points: 2
      }, {
        name: "Advanced Cloaking Device",
        id: 9,
        points: 4,
        ship: "TIE Phantom"
      }, {
        name: "Combat Retrofit",
        id: 10,
        points: 10,
        ship: "GR-75 Medium Transport",
        huge: true,
        modifier_func: function(stats) {
          stats.hull += 2;
          return stats.shields += 1;
        }
      }, {
        name: "B-Wing/E2",
        id: 11,
        points: 1,
        ship: "B-Wing",
        confersAddons: [
          {
            type: exportObj.Upgrade,
            slot: "Crew"
          }
        ]
      }, {
        name: "Countermeasures",
        id: 12,
        points: 3,
        restriction_func: function(ship) {
          var _ref;
          return (_ref = ship.data.large) != null ? _ref : false;
        }
      }, {
        name: "Experimental Interface",
        id: 13,
        unique: true,
        points: 3
      }, {
        name: "Tactical Jammer",
        id: 14,
        points: 1,
        restriction_func: function(ship) {
          var _ref;
          return (_ref = ship.data.large) != null ? _ref : false;
        }
      }, {
        name: "Autothrusters",
        id: 15,
        points: 2,
        restriction_func: function(ship) {
          return __indexOf.call(ship.effectiveStats().actions, "Boost") >= 0;
        }
      }, {
        name: "Advanced SLAM",
        id: 16,
        points: 2
      }, {
        name: "Twin Ion Engine Mk. II",
        id: 17,
        points: 1,
        restriction_func: function(ship) {
          return ship.data.name.indexOf('TIE') !== -1;
        },
        modifier_func: function(stats) {
          var s, _i, _len, _ref, _ref1, _results;
          _ref1 = (_ref = stats.maneuvers) != null ? _ref : [];
          _results = [];
          for (_i = 0, _len = _ref1.length; _i < _len; _i++) {
            s = _ref1[_i];
            if (s[1] !== 0) {
              s[1] = 2;
            }
            if (s[3] !== 0) {
              _results.push(s[3] = 2);
            } else {
              _results.push(void 0);
            }
          }
          return _results;
        }
      }, {
        name: "Maneuvering Fins",
        id: 18,
        points: 1,
        ship: "YV-666"
      }, {
        name: "Ion Projector",
        id: 19,
        points: 2,
        restriction_func: function(ship) {
          var _ref;
          return (_ref = ship.data.large) != null ? _ref : false;
        }
      }, {
        name: 'Integrated Astromech',
        id: 20,
        restriction_func: function(ship) {
          return ship.data.canonical_name.indexOf('xwing') !== -1;
        },
        points: 0
      }, {
        name: 'Optimized Generators',
        id: 21,
        points: 5,
        restriction_func: function(ship) {
          var _ref;
          return (_ref = ship.data.huge) != null ? _ref : false;
        }
      }, {
        name: 'Automated Protocols',
        id: 22,
        points: 5,
        restriction_func: function(ship) {
          var _ref;
          return (_ref = ship.data.huge) != null ? _ref : false;
        }
      }, {
        name: 'Ordnance Tubes',
        id: 23,
        points: 5,
        slot: 'Hardpoint',
        restriction_func: function(ship) {
          var _ref;
          return (_ref = ship.data.huge) != null ? _ref : false;
        }
      }, {
        name: 'Long-Range Scanners',
        id: 24,
        points: 0,
        restriction_func: function(ship) {
          var upgrade;
          return (((function() {
            var _i, _len, _ref, _results;
            _ref = ship.upgrades;
            _results = [];
            for (_i = 0, _len = _ref.length; _i < _len; _i++) {
              upgrade = _ref[_i];
              if (upgrade.slot === 'Torpedo' && (upgrade.occupied_by == null)) {
                _results.push(upgrade);
              }
            }
            return _results;
          })()).length >= 1) && (((function() {
            var _i, _len, _ref, _results;
            _ref = ship.upgrades;
            _results = [];
            for (_i = 0, _len = _ref.length; _i < _len; _i++) {
              upgrade = _ref[_i];
              if (upgrade.slot === 'Missile' && (upgrade.occupied_by == null)) {
                _results.push(upgrade);
              }
            }
            return _results;
          })()).length >= 1);
        }
      }, {
        name: "Guidance Chips",
        id: 25,
        points: 0
      }, {
        name: 'Vectored Thrusters',
        id: 26,
        points: 2,
        restriction_func: function(ship) {
          var _ref, _ref1;
          return !(((_ref = ship.data.large) != null ? _ref : false) || ((_ref1 = ship.data.huge) != null ? _ref1 : false));
        },
        modifier_func: function(stats) {
          if (__indexOf.call(stats.actions, 'Barrel Roll') < 0) {
            return stats.actions.push('Barrel Roll');
          }
        }
      }, {
        name: 'Smuggling Compartment',
        id: 27,
        points: 0,
        confersAddons: [
          {
            type: exportObj.Upgrade,
            slot: "Illicit"
          }, {
            type: exportObj.RestrictedModification,
            filter_func: function(mod) {
              return mod.points <= 3;
            }
          }
        ],
        limited: true,
        restriction_func: function(ship) {
          var _ref;
          return (_ref = ship.data.name) === 'YT-1300' || _ref === 'YT-2400';
        }
      }, {
        id: 28,
        name: 'Gyroscopic Targeting',
        ship: 'Lancer-class Pursuit Craft',
        points: 2
      }, {
        name: 'Captured TIE',
        id: 29,
        unique: true,
        ship: 'TIE Fighter',
        faction: 'Rebel Alliance',
        points: 1
      }, {
        name: 'Spacetug Tractor Array',
        id: 30,
        ship: 'Quadjumper',
        points: 2
      }, {
        name: 'Lightweight Frame',
        id: 31,
        points: 2,
        restriction_func: function(ship) {
          return ship.data.name.indexOf('TIE') !== -1 && ship.effectiveStats().agility < 3;
        }
      }, {
        name: 'Pulsed Ray Shield',
        id: 32,
        faction: ['Rebel Alliance', 'Scum and Villainy'],
        points: 2,
        restriction_func: function(ship) {
          return ship.effectiveStats().shields === 1;
        }
      }
    ],
    titlesById: [
      {
        name: "Zero Title",
        id: 0,
        skip: true
      }, {
        name: "Slave I",
        id: 1,
        unique: true,
        points: 0,
        ship: "Firespray-31",
        confersAddons: [
          {
            type: exportObj.Upgrade,
            slot: "Torpedo"
          }
        ]
      }, {
        name: "Millennium Falcon",
        id: 2,
        unique: true,
        points: 1,
        ship: "YT-1300",
        actions: "Evade",
        modifier_func: function(stats) {
          if (__indexOf.call(stats.actions, 'Evade') < 0) {
            return stats.actions.push('Evade');
          }
        }
      }, {
        name: "Moldy Crow",
        id: 3,
        unique: true,
        points: 3,
        ship: "HWK-290"
      }, {
        name: "ST-321",
        id: 4,
        unique: true,
        points: 3,
        ship: "Lambda-Class Shuttle"
      }, {
        name: "Royal Guard TIE",
        id: 5,
        points: 0,
        ship: "TIE Interceptor",
        confersAddons: [
          {
            type: exportObj.Modification
          }
        ],
        restriction_func: function(ship) {
          return ship.effectiveStats().skill > 4;
        },
        special_case: 'Royal Guard TIE'
      }, {
        name: "Dodonna's Pride",
        id: 6,
        unique: true,
        points: 4,
        ship: "CR90 Corvette (Fore)"
      }, {
        name: "A-Wing Test Pilot",
        id: 7,
        points: 0,
        ship: "A-Wing",
        restriction_func: function(ship) {
          return ship.effectiveStats().skill > 1;
        },
        validation_func: function(ship, upgrade_obj) {
          var elite, elites, upgrade;
          if (!(ship.effectiveStats().skill > 1)) {
            return false;
          }
          elites = (function() {
            var _i, _len, _ref, _results;
            _ref = ship.upgrades;
            _results = [];
            for (_i = 0, _len = _ref.length; _i < _len; _i++) {
              upgrade = _ref[_i];
              if (upgrade.slot === 'Elite' && (upgrade.data != null)) {
                _results.push(upgrade.data.canonical_name);
              }
            }
            return _results;
          })();
          while (elites.length > 0) {
            elite = elites.pop();
            if (__indexOf.call(elites, elite) >= 0) {
              return false;
            }
          }
          return true;
        },
        confersAddons: [
          {
            type: exportObj.Upgrade,
            slot: "Elite"
          }
        ],
        special_case: "A-Wing Test Pilot"
      }, {
        name: "B-Wing/E",
        id: 8,
        skip: true,
        points: 99,
        ship: "B-Wing",
        confersAddons: [
          {
            type: exportObj.Upgrade,
            slot: "Crew"
          }
        ]
      }, {
        name: "Tantive IV",
        id: 9,
        unique: true,
        points: 4,
        ship: "CR90 Corvette (Fore)",
        confersAddons: [
          {
            type: exportObj.Upgrade,
            slot: "Crew"
          }, {
            type: exportObj.Upgrade,
            slot: "Team"
          }
        ]
      }, {
        name: "Bright Hope",
        id: 10,
        energy: "+2",
        unique: true,
        points: 5,
        ship: "GR-75 Medium Transport",
        modifier_func: function(stats) {
          return stats.energy += 2;
        }
      }, {
        name: "Quantum Storm",
        id: 11,
        energy: "+1",
        unique: true,
        points: 4,
        ship: "GR-75 Medium Transport",
        modifier_func: function(stats) {
          return stats.energy += 1;
        }
      }, {
        name: "Dutyfree",
        id: 12,
        energy: "+0",
        unique: true,
        points: 2,
        ship: "GR-75 Medium Transport"
      }, {
        name: "Jaina's Light",
        id: 13,
        unique: true,
        points: 2,
        ship: "CR90 Corvette (Fore)"
      }, {
        name: "Outrider",
        id: 14,
        unique: true,
        points: 5,
        ship: "YT-2400"
      }, {
        name: "Dauntless",
        id: 15,
        unique: true,
        points: 2,
        ship: "VT-49 Decimator"
      }, {
        name: "Virago",
        id: 16,
        unique: true,
        points: 1,
        ship: "StarViper",
        restriction_func: function(ship) {
          return ship.pilot.skill > 3;
        },
        confersAddons: [
          {
            type: exportObj.Upgrade,
            slot: "System"
          }, {
            type: exportObj.Upgrade,
            slot: "Illicit"
          }
        ]
      }, {
        name: '"Heavy Scyk" Interceptor (Cannon)',
        canonical_name: '"Heavy Scyk" Interceptor'.canonicalize(),
        id: 17,
        points: 2,
        ship: "M3-A Interceptor",
        confersAddons: [
          {
            type: exportObj.Upgrade,
            slot: "Cannon"
          }
        ],
        modifier_func: function(stats) {
          return stats.hull += 1;
        }
      }, {
        name: '"Heavy Scyk" Interceptor (Torpedo)',
        canonical_name: '"Heavy Scyk" Interceptor'.canonicalize(),
        id: 18,
        points: 2,
        ship: "M3-A Interceptor",
        confersAddons: [
          {
            type: exportObj.Upgrade,
            slot: "Torpedo"
          }
        ],
        modifier_func: function(stats) {
          return stats.hull += 1;
        }
      }, {
        name: '"Heavy Scyk" Interceptor (Missile)',
        canonical_name: '"Heavy Scyk" Interceptor'.canonicalize(),
        id: 19,
        points: 2,
        ship: "M3-A Interceptor",
        confersAddons: [
          {
            type: exportObj.Upgrade,
            slot: "Missile"
          }
        ],
        modifier_func: function(stats) {
          return stats.hull += 1;
        }
      }, {
        name: 'IG-2000',
        faction: 'Scum and Villainy',
        id: 20,
        points: 0,
        ship: "Aggressor"
      }, {
        name: "BTL-A4 Y-Wing",
        id: 21,
        points: 0,
        ship: "Y-Wing"
      }, {
        name: "Andrasta",
        id: 22,
        unique: true,
        points: 0,
        ship: "Firespray-31",
        confersAddons: [
          {
            type: exportObj.Upgrade,
            slot: "Bomb"
          }, {
            type: exportObj.Upgrade,
            slot: "Bomb"
          }
        ]
      }, {
        name: 'TIE/x1',
        id: 23,
        points: 0,
        ship: "TIE Advanced",
        confersAddons: [
          {
            type: exportObj.Upgrade,
            slot: "System",
            adjustment_func: function(upgrade) {
              var copy;
              copy = $.extend(true, {}, upgrade);
              copy.points = Math.max(0, copy.points - 4);
              return copy;
            }
          }
        ]
      }, {
        name: "Hound's Tooth",
        id: 24,
        points: 6,
        unique: true,
        ship: "YV-666"
      }, {
        name: "Ghost",
        id: 25,
        unique: true,
        points: 0,
        ship: "VCX-100"
      }, {
        name: "Phantom",
        id: 26,
        unique: true,
        points: 0,
        ship: "Attack Shuttle"
      }, {
        name: "TIE/v1",
        id: 27,
        points: 1,
        ship: "TIE Advanced Prototype"
      }, {
        name: "Mist Hunter",
        id: 28,
        unique: true,
        points: 0,
        ship: "G-1A Starfighter",
        confersAddons: [
          {
            type: exportObj.RestrictedUpgrade,
            slot: "Cannon",
            filter_func: function(upgrade) {
              return upgrade.english_name === 'Tractor Beam';
            },
            auto_equip: 144
          }
        ],
        modifier_func: function(stats) {
          if (__indexOf.call(stats.actions, 'Barrel Roll') < 0) {
            return stats.actions.push('Barrel Roll');
          }
        }
      }, {
        name: "Punishing One",
        id: 29,
        unique: true,
        points: 12,
        ship: "JumpMaster 5000",
        modifier_func: function(stats) {
          return stats.attack += 1;
        }
      }, {
        name: 'Assailer',
        id: 30,
        points: 2,
        unique: true,
        ship: "Raider-class Corvette (Aft)"
      }, {
        name: 'Instigator',
        id: 31,
        points: 4,
        unique: true,
        ship: "Raider-class Corvette (Aft)"
      }, {
        name: 'Impetuous',
        id: 32,
        points: 3,
        unique: true,
        ship: "Raider-class Corvette (Aft)"
      }, {
        name: 'TIE/x7',
        id: 33,
        ship: 'TIE Defender',
        points: -2,
        unequips_upgrades: ['Cannon', 'Missile'],
        also_occupies_upgrades: ['Cannon', 'Missile']
      }, {
        name: 'TIE/D',
        id: 34,
        ship: 'TIE Defender',
        points: 0
      }, {
        name: 'TIE Shuttle',
        id: 35,
        ship: 'TIE Bomber',
        points: 0,
        unequips_upgrades: ['Torpedo', 'Torpedo', 'Missile', 'Missile', 'Bomb'],
        also_occupies_upgrades: ['Torpedo', 'Torpedo', 'Missile', 'Missile', 'Bomb'],
        confersAddons: [
          {
            type: exportObj.RestrictedUpgrade,
            slot: 'Crew',
            filter_func: function(upgrade) {
              return upgrade.points <= 4;
            }
          }, {
            type: exportObj.RestrictedUpgrade,
            slot: 'Crew',
            filter_func: function(upgrade) {
              return upgrade.points <= 4;
            }
          }
        ]
      }, {
        name: 'Requiem',
        id: 36,
        unique: true,
        ship: 'Gozanti-class Cruiser',
        energy: '+0',
        points: 4
      }, {
        name: 'Vector',
        id: 37,
        unique: true,
        ship: 'Gozanti-class Cruiser',
        energy: '+1',
        points: 2,
        modifier_func: function(stats) {
          return stats.energy += 1;
        }
      }, {
        name: 'Suppressor',
        id: 38,
        unique: true,
        ship: 'Gozanti-class Cruiser',
        energy: '+2',
        points: 6,
        modifier_func: function(stats) {
          return stats.energy += 2;
        }
      }, {
        name: 'Black One',
        id: 39,
        unique: true,
        ship: 'T-70 X-Wing',
        points: 1,
        restriction_func: function(ship) {
          return ship.effectiveStats().skill > 6;
        }
      }, {
        name: "Millennium Falcon (TFA)",
        canonical_name: "millenniumfalcon-swx57",
        id: 40,
        unique: true,
        points: 1,
        ship: "YT-1300"
      }, {
        name: 'Alliance Overhaul',
        id: 41,
        ship: 'ARC-170',
        points: 0
      }, {
        name: 'Special Ops Training',
        id: 42,
        ship: 'TIE/sf Fighter',
        points: 0
      }, {
        name: 'Concord Dawn Protector',
        id: 43,
        ship: 'Protectorate Starfighter',
        points: 1
      }, {
        name: 'Shadow Caster',
        id: 44,
        unique: true,
        ship: 'Lancer-class Pursuit Craft',
        points: 3
      }, {
        name: 'Kylo Ren\'s Shuttle',
        id: 45,
        unique: true,
        ship: 'Upsilon-class Shuttle',
        points: 2
      }, {
        name: 'Sabine\'s Masterpiece',
        id: 46,
        ship: 'TIE Fighter',
        faction: 'Rebel Alliance',
        unique: true,
        confersAddons: [
          {
            type: exportObj.Upgrade,
            slot: "Crew"
          }, {
            type: exportObj.Upgrade,
            slot: "Illicit"
          }
        ],
        points: 1
      }, {
        name: 'Pivot Wing',
        id: 47,
        ship: 'U-Wing',
        points: 0
      }, {
        name: 'Adaptive Ailerons',
        id: 48,
        ship: 'TIE Striker',
        points: 0
      }, {
        name: 'Merchant One',
        id: 49,
        ship: 'C-ROC Cruiser',
        points: 2,
        energy: '+1',
        confersAddons: [
          {
            type: exportObj.Upgrade,
            slot: "Crew"
          }, {
            type: exportObj.Upgrade,
            slot: "Team"
          }
        ],
        unequips_upgrades: ["Cargo"],
        also_occupies_upgrades: ["Cargo"],
        modifier_func: function(stats) {
          return stats.energy += 2;
        }
      }, {
        name: '"Light Scyk" Interceptor',
        id: 50,
        ship: 'M3-A Interceptor',
        points: -2,
        unequips_modifications: true,
        also_occupies_modifications: true,
        modifier_func: function(stats) {
          var s, _i, _len, _ref, _ref1, _results;
          _ref1 = (_ref = stats.maneuvers) != null ? _ref : [];
          _results = [];
          for (_i = 0, _len = _ref1.length; _i < _len; _i++) {
            s = _ref1[_i];
            if (s[1] !== 0) {
              s[1] = 2;
            }
            if (s[3] !== 0) {
              _results.push(s[3] = 2);
            } else {
              _results.push(void 0);
            }
          }
          return _results;
        }
      }, {
        name: 'Insatiable Worrt',
        id: 51,
        ship: 'C-ROC Cruiser',
        points: 1,
        energy: '-1',
        modifier_func: function(stats) {
          return stats.energy -= 1;
        }
      }, {
        name: 'Broken Horn',
        id: 52,
        ship: 'C-ROC Cruiser',
        points: 5,
        energy: '+2',
        modifier_func: function(stats) {
          return stats.energy += 2;
        }
      }, {
        name: 'Havoc',
        id: 53,
        ship: 'Scurrg H-6 Bomber',
        unique: true,
        points: 0,
        unequips_upgrades: ['Crew'],
        also_occupies_upgrades: ['Crew'],
        confersAddons: [
          {
            type: exportObj.Upgrade,
            slot: 'System'
          }, {
            type: exportObj.RestrictedUpgrade,
            slot: 'Salvaged Astromech',
            filter_func: function(upgrade) {
              return upgrade.unique;
            }
          }
        ]
      }, {
        name: 'Vaksai',
        id: 54,
        points: 0,
        ship: 'Kihraxz Fighter',
        confersAddons: [
          {
            type: exportObj.Modification
          }, {
            type: exportObj.Modification
          }
        ],
        special_case: 'Royal Guard TIE'
      }, {
        name: 'StarViper Mk. II',
        id: 55,
        limited: true,
        points: -3,
        ship: 'StarViper',
        confersAddons: [
          {
            type: exportObj.Title
          }
        ]
      }, {
        name: 'XG-1 Assault Configuration',
        id: 56,
        points: 1,
        ship: 'Alpha-class Star Wing',
        confersAddons: [
          {
            type: exportObj.Upgrade,
            slot: "Cannon"
          }, {
            type: exportObj.Upgrade,
            slot: "Cannon"
          }
        ]
      }, {
        name: 'Enforcer',
        id: 57,
        unique: true,
        ship: 'M12-L Kimogila Fighter',
        points: 1
      }, {
        name: 'Ghost (Phantom II)',
        id: 58,
        canonical_name: 'ghost-swx72',
        ship: 'VCX-100',
        points: 0
      }, {
        name: 'Phantom II',
        id: 59,
        ship: 'Sheathipede-class Shuttle',
        points: 0
      }, {
        name: 'First Order Vanguard',
        id: 60,
        ship: 'TIE Silencer',
        unique: true,
        points: 2
      }
    ],
    conditionsById: [
      {
        name: 'Zero Condition',
        id: 0
      }, {
        name: 'I\'ll Show You the Dark Side',
        id: 1,
        unique: true
      }, {
        name: 'A Debt to Pay',
        id: 2,
        unique: true
      }, {
        name: 'Suppressive Fire',
        id: 3,
        unique: true
      }, {
        name: 'Fanatical Devotion',
        id: 4,
        unique: true
      }, {
        name: 'Shadowed',
        id: 5,
        unique: true
      }, {
        name: 'Mimicked',
        id: 6,
        unique: true
      }, {
        name: 'Harpooned!',
        id: 7
      }, {
        name: 'Rattled',
        id: 8,
        unique: true
      }
    ]
  };
};

exportObj.setupCardData = function(basic_cards, pilot_translations, upgrade_translations, modification_translations, title_translations, condition_translations) {
  var card, cards, condition, condition_data, condition_name, e, expansion, field, i, modification, modification_data, modification_name, name, pilot, pilot_data, pilot_name, ship_data, ship_name, source, title, title_data, title_name, translation, translations, upgrade, upgrade_data, upgrade_name, _base, _base1, _base10, _base2, _base3, _base4, _base5, _base6, _base7, _base8, _base9, _i, _j, _k, _l, _len, _len1, _len10, _len11, _len12, _len13, _len14, _len15, _len2, _len3, _len4, _len5, _len6, _len7, _len8, _len9, _m, _n, _name, _name1, _name2, _name3, _name4, _name5, _name6, _name7, _name8, _o, _p, _q, _r, _ref, _ref1, _ref10, _ref11, _ref12, _ref13, _ref14, _ref15, _ref16, _ref17, _ref18, _ref19, _ref2, _ref20, _ref21, _ref22, _ref23, _ref24, _ref25, _ref26, _ref27, _ref28, _ref29, _ref3, _ref30, _ref31, _ref4, _ref5, _ref6, _ref7, _ref8, _ref9, _s, _t, _u, _v, _w, _x;
  _ref = basic_cards.pilotsById;
  for (i = _i = 0, _len = _ref.length; _i < _len; i = ++_i) {
    pilot_data = _ref[i];
    if (pilot_data.id !== i) {
      throw new Error("ID mismatch: pilot at index " + i + " has ID " + pilot_data.id);
    }
  }
  _ref1 = basic_cards.upgradesById;
  for (i = _j = 0, _len1 = _ref1.length; _j < _len1; i = ++_j) {
    upgrade_data = _ref1[i];
    if (upgrade_data.id !== i) {
      throw new Error("ID mismatch: upgrade at index " + i + " has ID " + upgrade_data.id);
    }
  }
  _ref2 = basic_cards.titlesById;
  for (i = _k = 0, _len2 = _ref2.length; _k < _len2; i = ++_k) {
    title_data = _ref2[i];
    if (title_data.id !== i) {
      throw new Error("ID mismatch: title at index " + i + " has ID " + title_data.id);
    }
  }
  _ref3 = basic_cards.modificationsById;
  for (i = _l = 0, _len3 = _ref3.length; _l < _len3; i = ++_l) {
    modification_data = _ref3[i];
    if (modification_data.id !== i) {
      throw new Error("ID mismatch: modification at index " + i + " has ID " + modification_data.id);
    }
  }
  _ref4 = basic_cards.conditionsById;
  for (i = _m = 0, _len4 = _ref4.length; _m < _len4; i = ++_m) {
    condition_data = _ref4[i];
    if (condition_data.id !== i) {
      throw new Error("ID mismatch: condition at index " + i + " has ID " + condition_data.id);
    }
  }
  exportObj.pilots = {};
  _ref5 = basic_cards.pilotsById;
  for (_n = 0, _len5 = _ref5.length; _n < _len5; _n++) {
    pilot_data = _ref5[_n];
    if (pilot_data.skip == null) {
      pilot_data.sources = [];
      pilot_data.english_name = pilot_data.name;
      pilot_data.english_ship = pilot_data.ship;
      if (pilot_data.canonical_name == null) {
        pilot_data.canonical_name = pilot_data.english_name.canonicalize();
      }
      exportObj.pilots[pilot_data.name] = pilot_data;
    }
  }
  for (pilot_name in pilot_translations) {
    translations = pilot_translations[pilot_name];
    for (field in translations) {
      translation = translations[field];
      try {
        exportObj.pilots[pilot_name][field] = translation;
      } catch (_error) {
        e = _error;
        console.error("[pilot_data] Cannot find translation for attribute " + field + " for pilot " + pilot_name);
        throw e;
      }
    }
  }
  exportObj.upgrades = {};
  _ref6 = basic_cards.upgradesById;
  for (_o = 0, _len6 = _ref6.length; _o < _len6; _o++) {
    upgrade_data = _ref6[_o];
    if (upgrade_data.skip == null) {
      upgrade_data.sources = [];
      upgrade_data.english_name = upgrade_data.name;
      if (upgrade_data.canonical_name == null) {
        upgrade_data.canonical_name = upgrade_data.english_name.canonicalize();
      }
      exportObj.upgrades[upgrade_data.name] = upgrade_data;
    }
  }
  for (upgrade_name in upgrade_translations) {
    translations = upgrade_translations[upgrade_name];
    for (field in translations) {
      translation = translations[field];
      try {
        exportObj.upgrades[upgrade_name][field] = translation;
      } catch (_error) {
        e = _error;
        console.error("[upgrade_data] Cannot find translation for attribute " + field + " for upgrade " + upgrade_name);
        throw e;
      }
    }
  }
  exportObj.modifications = {};
  _ref7 = basic_cards.modificationsById;
  for (_p = 0, _len7 = _ref7.length; _p < _len7; _p++) {
    modification_data = _ref7[_p];
    if (modification_data.skip == null) {
      modification_data.sources = [];
      modification_data.english_name = modification_data.name;
      if (modification_data.canonical_name == null) {
        modification_data.canonical_name = modification_data.english_name.canonicalize();
      }
      exportObj.modifications[modification_data.name] = modification_data;
    }
  }
  for (modification_name in modification_translations) {
    translations = modification_translations[modification_name];
    for (field in translations) {
      translation = translations[field];
      try {
        exportObj.modifications[modification_name][field] = translation;
      } catch (_error) {
        e = _error;
        console.error("[modification_data] Cannot find translation for attribute " + field + " for modification " + modification_name);
        throw e;
      }
    }
  }
  exportObj.titles = {};
  _ref8 = basic_cards.titlesById;
  for (_q = 0, _len8 = _ref8.length; _q < _len8; _q++) {
    title_data = _ref8[_q];
    if (title_data.skip == null) {
      title_data.sources = [];
      title_data.english_name = title_data.name;
      if (title_data.canonical_name == null) {
        title_data.canonical_name = title_data.english_name.canonicalize();
      }
      exportObj.titles[title_data.name] = title_data;
    }
  }
  for (title_name in title_translations) {
    translations = title_translations[title_name];
    for (field in translations) {
      translation = translations[field];
      try {
        exportObj.titles[title_name][field] = translation;
      } catch (_error) {
        e = _error;
        console.error("[title_data] Cannot find translation for attribute " + field + " for title " + title_name);
        throw e;
      }
    }
  }
  exportObj.conditions = {};
  _ref9 = basic_cards.conditionsById;
  for (_r = 0, _len9 = _ref9.length; _r < _len9; _r++) {
    condition_data = _ref9[_r];
    if (condition_data.skip == null) {
      condition_data.sources = [];
      condition_data.english_name = condition_data.name;
      if (condition_data.canonical_name == null) {
        condition_data.canonical_name = condition_data.english_name.canonicalize();
      }
      exportObj.conditions[condition_data.name] = condition_data;
    }
  }
  for (condition_name in condition_translations) {
    translations = condition_translations[condition_name];
    for (field in translations) {
      translation = translations[field];
      try {
        exportObj.conditions[condition_name][field] = translation;
      } catch (_error) {
        e = _error;
        console.error("[condition_data]Cannot find translation for attribute " + field + " for condition " + condition_name);
        throw e;
      }
    }
  }
  _ref10 = basic_cards.ships;
  for (ship_name in _ref10) {
    ship_data = _ref10[ship_name];
    if (ship_data.english_name == null) {
      ship_data.english_name = ship_name;
    }
    if (ship_data.canonical_name == null) {
      ship_data.canonical_name = ship_data.english_name.canonicalize();
    }
  }
  _ref11 = exportObj.manifestByExpansion;
  for (expansion in _ref11) {
    cards = _ref11[expansion];
    for (_s = 0, _len10 = cards.length; _s < _len10; _s++) {
      card = cards[_s];
      if (card.skipForSource) {
        continue;
      }
      try {
        switch (card.type) {
          case 'pilot':
            exportObj.pilots[card.name].sources.push(expansion);
            break;
          case 'upgrade':
            exportObj.upgrades[card.name].sources.push(expansion);
            break;
          case 'modification':
            exportObj.modifications[card.name].sources.push(expansion);
            break;
          case 'title':
            exportObj.titles[card.name].sources.push(expansion);
            break;
          case 'ship':
            '';
            break;
          default:
            throw new Error("Unexpected card type " + card.type + " for card " + card.name + " of " + expansion);
        }
      } catch (_error) {
        e = _error;
        console.error("Error adding card " + card.name + " (" + card.type + ") from " + expansion);
      }
    }
  }
  _ref12 = exportObj.pilots;
  for (name in _ref12) {
    card = _ref12[name];
    card.sources = card.sources.sort();
  }
  _ref13 = exportObj.upgrades;
  for (name in _ref13) {
    card = _ref13[name];
    card.sources = card.sources.sort();
  }
  _ref14 = exportObj.modifications;
  for (name in _ref14) {
    card = _ref14[name];
    card.sources = card.sources.sort();
  }
  _ref15 = exportObj.titles;
  for (name in _ref15) {
    card = _ref15[name];
    card.sources = card.sources.sort();
  }
  exportObj.expansions = {};
  exportObj.pilotsById = {};
  exportObj.pilotsByLocalizedName = {};
  _ref16 = exportObj.pilots;
  for (pilot_name in _ref16) {
    pilot = _ref16[pilot_name];
    exportObj.fixIcons(pilot);
    exportObj.pilotsById[pilot.id] = pilot;
    exportObj.pilotsByLocalizedName[pilot.name] = pilot;
    _ref17 = pilot.sources;
    for (_t = 0, _len11 = _ref17.length; _t < _len11; _t++) {
      source = _ref17[_t];
      if (!(source in exportObj.expansions)) {
        exportObj.expansions[source] = 1;
      }
    }
  }
  if (Object.keys(exportObj.pilotsById).length !== Object.keys(exportObj.pilots).length) {
    throw new Error("At least one pilot shares an ID with another");
  }
  exportObj.pilotsByFactionCanonicalName = {};
  exportObj.pilotsByUniqueName = {};
  _ref18 = exportObj.pilots;
  for (pilot_name in _ref18) {
    pilot = _ref18[pilot_name];
    ((_base = ((_base1 = exportObj.pilotsByFactionCanonicalName)[_name1 = pilot.faction] != null ? _base1[_name1] : _base1[_name1] = {}))[_name = pilot.canonical_name] != null ? _base[_name] : _base[_name] = []).push(pilot);
    ((_base2 = exportObj.pilotsByUniqueName)[_name2 = pilot.canonical_name.getXWSBaseName()] != null ? _base2[_name2] : _base2[_name2] = []).push(pilot);
    switch (pilot.faction) {
      case 'Resistance':
        ((_base3 = ((_base4 = exportObj.pilotsByFactionCanonicalName)['Rebel Alliance'] != null ? _base4['Rebel Alliance'] : _base4['Rebel Alliance'] = {}))[_name3 = pilot.canonical_name] != null ? _base3[_name3] : _base3[_name3] = []).push(pilot);
        break;
      case 'First Order':
        ((_base5 = ((_base6 = exportObj.pilotsByFactionCanonicalName)['Galactic Empire'] != null ? _base6['Galactic Empire'] : _base6['Galactic Empire'] = {}))[_name4 = pilot.canonical_name] != null ? _base5[_name4] : _base5[_name4] = []).push(pilot);
    }
  }
  exportObj.upgradesById = {};
  exportObj.upgradesByLocalizedName = {};
  _ref19 = exportObj.upgrades;
  for (upgrade_name in _ref19) {
    upgrade = _ref19[upgrade_name];
    exportObj.fixIcons(upgrade);
    exportObj.upgradesById[upgrade.id] = upgrade;
    exportObj.upgradesByLocalizedName[upgrade.name] = upgrade;
    _ref20 = upgrade.sources;
    for (_u = 0, _len12 = _ref20.length; _u < _len12; _u++) {
      source = _ref20[_u];
      if (!(source in exportObj.expansions)) {
        exportObj.expansions[source] = 1;
      }
    }
  }
  if (Object.keys(exportObj.upgradesById).length !== Object.keys(exportObj.upgrades).length) {
    throw new Error("At least one upgrade shares an ID with another");
  }
  exportObj.upgradesBySlotCanonicalName = {};
  exportObj.upgradesBySlotUniqueName = {};
  _ref21 = exportObj.upgrades;
  for (upgrade_name in _ref21) {
    upgrade = _ref21[upgrade_name];
    ((_base7 = exportObj.upgradesBySlotCanonicalName)[_name5 = upgrade.slot] != null ? _base7[_name5] : _base7[_name5] = {})[upgrade.canonical_name] = upgrade;
    ((_base8 = exportObj.upgradesBySlotUniqueName)[_name6 = upgrade.slot] != null ? _base8[_name6] : _base8[_name6] = {})[upgrade.canonical_name.getXWSBaseName()] = upgrade;
  }
  exportObj.modificationsById = {};
  exportObj.modificationsByLocalizedName = {};
  _ref22 = exportObj.modifications;
  for (modification_name in _ref22) {
    modification = _ref22[modification_name];
    exportObj.fixIcons(modification);
    if (modification.huge != null) {
      if (modification.restriction_func == null) {
        modification.restriction_func = exportObj.hugeOnly;
      }
    } else if (modification.restriction_func == null) {
      modification.restriction_func = function(ship) {
        var _ref23;
        return !((_ref23 = ship.data.huge) != null ? _ref23 : false);
      };
    }
    exportObj.modificationsById[modification.id] = modification;
    exportObj.modificationsByLocalizedName[modification.name] = modification;
    _ref23 = modification.sources;
    for (_v = 0, _len13 = _ref23.length; _v < _len13; _v++) {
      source = _ref23[_v];
      if (!(source in exportObj.expansions)) {
        exportObj.expansions[source] = 1;
      }
    }
  }
  if (Object.keys(exportObj.modificationsById).length !== Object.keys(exportObj.modifications).length) {
    throw new Error("At least one modification shares an ID with another");
  }
  exportObj.modificationsByCanonicalName = {};
  exportObj.modificationsByUniqueName = {};
  _ref24 = exportObj.modifications;
  for (modification_name in _ref24) {
    modification = _ref24[modification_name];
    (exportObj.modificationsByCanonicalName != null ? exportObj.modificationsByCanonicalName : exportObj.modificationsByCanonicalName = {})[modification.canonical_name] = modification;
    (exportObj.modificationsByUniqueName != null ? exportObj.modificationsByUniqueName : exportObj.modificationsByUniqueName = {})[modification.canonical_name.getXWSBaseName()] = modification;
  }
  exportObj.titlesById = {};
  exportObj.titlesByLocalizedName = {};
  _ref25 = exportObj.titles;
  for (title_name in _ref25) {
    title = _ref25[title_name];
    exportObj.fixIcons(title);
    exportObj.titlesById[title.id] = title;
    exportObj.titlesByLocalizedName[title.name] = title;
    _ref26 = title.sources;
    for (_w = 0, _len14 = _ref26.length; _w < _len14; _w++) {
      source = _ref26[_w];
      if (!(source in exportObj.expansions)) {
        exportObj.expansions[source] = 1;
      }
    }
  }
  if (Object.keys(exportObj.titlesById).length !== Object.keys(exportObj.titles).length) {
    throw new Error("At least one title shares an ID with another");
  }
  exportObj.conditionsById = {};
  _ref27 = exportObj.conditions;
  for (condition_name in _ref27) {
    condition = _ref27[condition_name];
    exportObj.fixIcons(condition);
    exportObj.conditionsById[condition.id] = condition;
    _ref28 = condition.sources;
    for (_x = 0, _len15 = _ref28.length; _x < _len15; _x++) {
      source = _ref28[_x];
      if (!(source in exportObj.expansions)) {
        exportObj.expansions[source] = 1;
      }
    }
  }
  if (Object.keys(exportObj.conditionsById).length !== Object.keys(exportObj.conditions).length) {
    throw new Error("At least one condition shares an ID with another");
  }
  exportObj.titlesByShip = {};
  _ref29 = exportObj.titles;
  for (title_name in _ref29) {
    title = _ref29[title_name];
    if (!(title.ship in exportObj.titlesByShip)) {
      exportObj.titlesByShip[title.ship] = [];
    }
    exportObj.titlesByShip[title.ship].push(title);
  }
  exportObj.titlesByCanonicalName = {};
  exportObj.titlesByUniqueName = {};
  _ref30 = exportObj.titles;
  for (title_name in _ref30) {
    title = _ref30[title_name];
    if (title.canonical_name === '"Heavy Scyk" Interceptor'.canonicalize()) {
      ((_base9 = (exportObj.titlesByCanonicalName != null ? exportObj.titlesByCanonicalName : exportObj.titlesByCanonicalName = {}))[_name7 = title.canonical_name] != null ? _base9[_name7] : _base9[_name7] = []).push(title);
      ((_base10 = (exportObj.titlesByUniqueName != null ? exportObj.titlesByUniqueName : exportObj.titlesByUniqueName = {}))[_name8 = title.canonical_name.getXWSBaseName()] != null ? _base10[_name8] : _base10[_name8] = []).push(title);
    } else {
      (exportObj.titlesByCanonicalName != null ? exportObj.titlesByCanonicalName : exportObj.titlesByCanonicalName = {})[title.canonical_name] = title;
      (exportObj.titlesByUniqueName != null ? exportObj.titlesByUniqueName : exportObj.titlesByUniqueName = {})[title.canonical_name.getXWSBaseName()] = title;
    }
  }
  exportObj.conditionsByCanonicalName = {};
  _ref31 = exportObj.conditions;
  for (condition_name in _ref31) {
    condition = _ref31[condition_name];
    (exportObj.conditionsByCanonicalName != null ? exportObj.conditionsByCanonicalName : exportObj.conditionsByCanonicalName = {})[condition.canonical_name] = condition;
  }
  return exportObj.expansions = Object.keys(exportObj.expansions).sort();
};

exportObj.fixIcons = function(data) {
  if (data.text != null) {
    return data.text = data.text.replace(/%ASTROMECH%/g, '<i class="xwing-miniatures-font xwing-miniatures-font-astromech"></i>').replace(/%BANKLEFT%/g, '<i class="xwing-miniatures-font xwing-miniatures-font-bankleft"></i>').replace(/%BANKRIGHT%/g, '<i class="xwing-miniatures-font xwing-miniatures-font-bankright"></i>').replace(/%BARRELROLL%/g, '<i class="xwing-miniatures-font xwing-miniatures-font-barrelroll"></i>').replace(/%BOMB%/g, '<i class="xwing-miniatures-font xwing-miniatures-font-bomb"></i>').replace(/%BOOST%/g, '<i class="xwing-miniatures-font xwing-miniatures-font-boost"></i>').replace(/%CANNON%/g, '<i class="xwing-miniatures-font xwing-miniatures-font-cannon"></i>').replace(/%CARGO%/g, '<i class="xwing-miniatures-font xwing-miniatures-font-cargo"></i>').replace(/%CLOAK%/g, '<i class="xwing-miniatures-font xwing-miniatures-font-cloak"></i>').replace(/%COORDINATE%/g, '<i class="xwing-miniatures-font xwing-miniatures-font-coordinate"></i>').replace(/%CRIT%/g, '<i class="xwing-miniatures-font xwing-miniatures-font-crit"></i>').replace(/%CREW%/g, '<i class="xwing-miniatures-font xwing-miniatures-font-crew"></i>').replace(/%DUALCARD%/g, '<span class="card-restriction">Dual card.</span>').replace(/%ELITE%/g, '<i class="xwing-miniatures-font xwing-miniatures-font-elite"></i>').replace(/%EVADE%/g, '<i class="xwing-miniatures-font xwing-miniatures-font-evade"></i>').replace(/%FOCUS%/g, '<i class="xwing-miniatures-font xwing-miniatures-font-focus"></i>').replace(/%HARDPOINT%/g, '<i class="xwing-miniatures-font xwing-miniatures-font-hardpoint"></i>').replace(/%HIT%/g, '<i class="xwing-miniatures-font xwing-miniatures-font-hit"></i>').replace(/%ILLICIT%/g, '<i class="xwing-miniatures-font xwing-miniatures-font-illicit"></i>').replace(/%JAM%/g, '<i class="xwing-miniatures-font xwing-miniatures-font-jam"></i>').replace(/%KTURN%/g, '<i class="xwing-miniatures-font xwing-miniatures-font-kturn"></i>').replace(/%MISSILE%/g, '<i class="xwing-miniatures-font xwing-miniatures-font-missile"></i>').replace(/%RECOVER%/g, '<i class="xwing-miniatures-font xwing-miniatures-font-recover"></i>').replace(/%REINFORCE%/g, '<i class="xwing-miniatures-font xwing-miniatures-font-reinforce"></i>').replace(/%SALVAGEDASTROMECH%/g, '<i class="xwing-miniatures-font xwing-miniatures-font-salvagedastromech"></i>').replace(/%SLAM%/g, '<i class="xwing-miniatures-font xwing-miniatures-font-slam"></i>').replace(/%SLOOPLEFT%/g, '<i class="xwing-miniatures-font xwing-miniatures-font-sloopleft"></i>').replace(/%SLOOPRIGHT%/g, '<i class="xwing-miniatures-font xwing-miniatures-font-sloopright"></i>').replace(/%STRAIGHT%/g, '<i class="xwing-miniatures-font xwing-miniatures-font-straight"></i>').replace(/%STOP%/g, '<i class="xwing-miniatures-font xwing-miniatures-font-stop"></i>').replace(/%SYSTEM%/g, '<i class="xwing-miniatures-font xwing-miniatures-font-system"></i>').replace(/%TARGETLOCK%/g, '<i class="xwing-miniatures-font xwing-miniatures-font-targetlock"></i>').replace(/%TEAM%/g, '<i class="xwing-miniatures-font xwing-miniatures-font-team"></i>').replace(/%TECH%/g, '<i class="xwing-miniatures-font xwing-miniatures-font-tech"></i>').replace(/%TORPEDO%/g, '<i class="xwing-miniatures-font xwing-miniatures-font-torpedo"></i>').replace(/%TROLLLEFT%/g, '<i class="xwing-miniatures-font xwing-miniatures-font-trollleft"></i>').replace(/%TROLLRIGHT%/g, '<i class="xwing-miniatures-font xwing-miniatures-font-trollright"></i>').replace(/%TURNLEFT%/g, '<i class="xwing-miniatures-font xwing-miniatures-font-turnleft"></i>').replace(/%TURNRIGHT%/g, '<i class="xwing-miniatures-font xwing-miniatures-font-turnright"></i>').replace(/%TURRET%/g, '<i class="xwing-miniatures-font xwing-miniatures-font-turret"></i>').replace(/%UTURN%/g, '<i class="xwing-miniatures-font xwing-miniatures-font-kturn"></i>').replace(/%HUGESHIPONLY%/g, '<span class="card-restriction">Huge ship only.</span>').replace(/%LARGESHIPONLY%/g, '<span class="card-restriction">Large ship only.</span>').replace(/%SMALLSHIPONLY%/g, '<span class="card-restriction">Small ship only.</span>').replace(/%REBELONLY%/g, '<span class="card-restriction">Rebel only.</span>').replace(/%IMPERIALONLY%/g, '<span class="card-restriction">Imperial only.</span>').replace(/%SCUMONLY%/g, '<span class="card-restriction">Scum only.</span>').replace(/%LIMITED%/g, '<span class="card-restriction">Limited.</span>').replace(/%LINEBREAK%/g, '<br /><br />').replace(/%DE_HUGESHIPONLY%/g, '<span class="card-restriction">Nur für riesige Schiffe.</span>').replace(/%DE_LARGESHIPONLY%/g, '<span class="card-restriction">Nur für grosse Schiffe.</span>').replace(/%DE_REBELONLY%/g, '<span class="card-restriction">Nur für Rebellen.</span>').replace(/%DE_IMPERIALONLY%/g, '<span class="card-restriction">Nur für das Imperium.</span>').replace(/%DE_SCUMONLY%/g, '<span class="card-restriction">Nur für Abschaum & Kriminelle.</span>').replace(/%DE_GOZANTIONLY%/g, '<span class="card-restriction">Nur für Kreuzer der <em>Gozanti</em>-Klasse.</span>').replace(/%DE_LIMITED%/g, '<span class="card-restriction">Limitiert.</span>').replace(/%DE_SMALLSHIPONLY%/g, '<span class="card-restriction">Nur für kleine Schiffe.</span>').replace(/%FR_HUGESHIPONLY%/g, '<span class="card-restriction">Vaisseau immense uniquement.</span>').replace(/%FR_LARGESHIPONLY%/g, '<span class="card-restriction">Grand vaisseau uniquement.</span>').replace(/%FR_REBELONLY%/g, '<span class="card-restriction">Rebelle uniquement.</span>').replace(/%FR_IMPERIALONLY%/g, '<span class="card-restriction">Impérial uniquement.</span>').replace(/%FR_SCUMONLY%/g, '<span class="card-restriction">Racailles uniquement.</span>').replace(/%GOZANTIONLY%/g, '<span class="card-restriction"><em>Gozanti</em>-class cruiser only.</span>');
  }
};

exportObj.canonicalizeShipNames = function(card_data) {
  var ship_data, ship_name, _ref, _results;
  _ref = card_data.ships;
  _results = [];
  for (ship_name in _ref) {
    ship_data = _ref[ship_name];
    ship_data.english_name = ship_name;
    _results.push(ship_data.canonical_name != null ? ship_data.canonical_name : ship_data.canonical_name = ship_data.english_name.canonicalize());
  }
  return _results;
};

exportObj.renameShip = function(english_name, new_name) {
  exportObj.ships[new_name] = exportObj.ships[english_name];
  exportObj.ships[new_name].name = new_name;
  exportObj.ships[new_name].english_name = english_name;
  return delete exportObj.ships[english_name];
};

exportObj = typeof exports !== "undefined" && exports !== null ? exports : this;

if (exportObj.codeToLanguage == null) {
  exportObj.codeToLanguage = {};
}

exportObj.codeToLanguage.en = 'English';

if (exportObj.translations == null) {
  exportObj.translations = {};
}

exportObj.translations.English = {
  action: {
    "Barrel Roll": "Barrel Roll",
    "Boost": "Boost",
    "Evade": "Evade",
    "Focus": "Focus",
    "Target Lock": "Target Lock",
    "Recover": "Recover",
    "Reinforce": "Reinforce",
    "Jam": "Jam",
    "Coordinate": "Coordinate",
    "Cloak": "Cloak",
    "SLAM": "SLAM"
  },
  slot: {
    "Astromech": "Astromech",
    "Bomb": "Bomb",
    "Cannon": "Cannon",
    "Crew": "Crew",
    "Elite": "Elite",
    "Missile": "Missile",
    "System": "System",
    "Torpedo": "Torpedo",
    "Turret": "Turret",
    "Cargo": "Cargo",
    "Hardpoint": "Hardpoint",
    "Team": "Team",
    "Illicit": "Illicit",
    "Salvaged Astromech": "Salvaged Astromech"
  },
  sources: {
    "Core": "Core",
    "A-Wing Expansion Pack": "A-Wing Expansion Pack",
    "B-Wing Expansion Pack": "B-Wing Expansion Pack",
    "X-Wing Expansion Pack": "X-Wing Expansion Pack",
    "Y-Wing Expansion Pack": "Y-Wing Expansion Pack",
    "Millennium Falcon Expansion Pack": "Millennium Falcon Expansion Pack",
    "HWK-290 Expansion Pack": "HWK-290 Expansion Pack",
    "TIE Fighter Expansion Pack": "TIE Fighter Expansion Pack",
    "TIE Interceptor Expansion Pack": "TIE Interceptor Expansion Pack",
    "TIE Bomber Expansion Pack": "TIE Bomber Expansion Pack",
    "TIE Advanced Expansion Pack": "TIE Advanced Expansion Pack",
    "Lambda-Class Shuttle Expansion Pack": "Lambda-Class Shuttle Expansion Pack",
    "Slave I Expansion Pack": "Slave I Expansion Pack",
    "Imperial Aces Expansion Pack": "Imperial Aces Expansion Pack",
    "Rebel Transport Expansion Pack": "Rebel Transport Expansion Pack",
    "Z-95 Headhunter Expansion Pack": "Z-95 Headhunter Expansion Pack",
    "TIE Defender Expansion Pack": "TIE Defender Expansion Pack",
    "E-Wing Expansion Pack": "E-Wing Expansion Pack",
    "TIE Phantom Expansion Pack": "TIE Phantom Expansion Pack",
    "Tantive IV Expansion Pack": "Tantive IV Expansion Pack",
    "Rebel Aces Expansion Pack": "Rebel Aces Expansion Pack",
    "YT-2400 Freighter Expansion Pack": "YT-2400 Freighter Expansion Pack",
    "VT-49 Decimator Expansion Pack": "VT-49 Decimator Expansion Pack",
    "StarViper Expansion Pack": "StarViper Expansion Pack",
    "M3-A Interceptor Expansion Pack": "M3-A Interceptor Expansion Pack",
    "IG-2000 Expansion Pack": "IG-2000 Expansion Pack",
    "Most Wanted Expansion Pack": "Most Wanted Expansion Pack",
    "Imperial Raider Expansion Pack": "Imperial Raider Expansion Pack",
    "Hound's Tooth Expansion Pack": "Hound's Tooth Expansion Pack",
    "Kihraxz Fighter Expansion Pack": "Kihraxz Fighter Expansion Pack",
    "K-Wing Expansion Pack": "K-Wing Expansion Pack",
    "TIE Punisher Expansion Pack": "TIE Punisher Expansion Pack",
    "The Force Awakens Core Set": "The Force Awakens Core Set"
  },
  ui: {
    shipSelectorPlaceholder: "Select a ship",
    pilotSelectorPlaceholder: "Select a pilot",
    upgradePlaceholder: function(translator, language, slot) {
      return "No " + (translator(language, 'slot', slot)) + " Upgrade";
    },
    modificationPlaceholder: "No Modification",
    titlePlaceholder: "No Title",
    upgradeHeader: function(translator, language, slot) {
      return "" + (translator(language, 'slot', slot)) + " Upgrade";
    },
    unreleased: "unreleased",
    epic: "epic",
    limited: "limited"
  },
  byCSSSelector: {
    '.unreleased-content-used .translated': 'This squad uses unreleased content!',
    '.epic-content-used .translated': 'This squad uses Epic content!',
    '.illegal-epic-too-many-small-ships .translated': 'You may not field more than 12 of the same type Small ship!',
    '.illegal-epic-too-many-large-ships .translated': 'You may not field more than 6 of the same type Large ship!',
    '.collection-invalid .translated': 'You cannot field this list with your collection!',
    '.game-type-selector option[value="standard"]': 'Standard',
    '.game-type-selector option[value="custom"]': 'Custom',
    '.game-type-selector option[value="epic"]': 'Epic',
    '.game-type-selector option[value="team-epic"]': 'Team Epic',
    '.xwing-card-browser option[value="name"]': 'Name',
    '.xwing-card-browser option[value="source"]': 'Source',
    '.xwing-card-browser option[value="type-by-points"]': 'Type (by Points)',
    '.xwing-card-browser option[value="type-by-name"]': 'Type (by Name)',
    '.xwing-card-browser .translate.select-a-card': 'Select a card from the list at the left.',
    '.xwing-card-browser .translate.sort-cards-by': 'Sort cards by',
    '.info-well .info-ship td.info-header': 'Ship',
    '.info-well .info-skill td.info-header': 'Skill',
    '.info-well .info-actions td.info-header': 'Actions',
    '.info-well .info-upgrades td.info-header': 'Upgrades',
    '.info-well .info-range td.info-header': 'Range',
    '.clear-squad': 'New Squad',
    '.save-list': 'Save',
    '.save-list-as': 'Save as…',
    '.delete-list': 'Delete',
    '.backend-list-my-squads': 'Load squad',
    '.view-as-text': '<span class="hidden-phone"><i class="fa fa-print"></i>&nbsp;Print/View as </span>Text',
    '.randomize': 'Random!',
    '.randomize-options': 'Randomizer options…',
    '.notes-container > span': 'Squad Notes',
    '.bbcode-list': 'Copy the BBCode below and paste it into your forum post.<textarea></textarea><button class="btn btn-copy">Copy</button>',
    '.html-list': '<textarea></textarea><button class="btn btn-copy">Copy</button>',
    '.vertical-space-checkbox': "Add space for damage/upgrade cards when printing <input type=\"checkbox\" class=\"toggle-vertical-space\" />",
    '.color-print-checkbox': "Print color <input type=\"checkbox\" class=\"toggle-color-print\" />",
    '.print-list': '<i class="fa fa-print"></i>&nbsp;Print',
    '.do-randomize': 'Randomize!',
    '#empireTab': 'Galactic Empire',
    '#rebelTab': 'Rebel Alliance',
    '#scumTab': 'Scum and Villainy',
    '#aboutTab': 'About',
    '.choose-obstacles': 'Choose Obstacles',
    '.choose-obstacles-description': 'Choose up to three obstacles to include in the permalink for use in external programs. (This feature is in BETA; support for displaying which obstacles were selected in the printout is not yet supported.)',
    '.coreasteroid0-select': 'Core Asteroid 0',
    '.coreasteroid1-select': 'Core Asteroid 1',
    '.coreasteroid2-select': 'Core Asteroid 2',
    '.coreasteroid3-select': 'Core Asteroid 3',
    '.coreasteroid4-select': 'Core Asteroid 4',
    '.coreasteroid5-select': 'Core Asteroid 5',
    '.yt2400debris0-select': 'YT2400 Debris 0',
    '.yt2400debris1-select': 'YT2400 Debris 1',
    '.yt2400debris2-select': 'YT2400 Debris 2',
    '.vt49decimatordebris0-select': 'VT49 Debris 0',
    '.vt49decimatordebris1-select': 'VT49 Debris 1',
    '.vt49decimatordebris2-select': 'VT49 Debris 2',
    '.core2asteroid0-select': 'Force Awakens Asteroid 0',
    '.core2asteroid1-select': 'Force Awakens Asteroid 1',
    '.core2asteroid2-select': 'Force Awakens Asteroid 2',
    '.core2asteroid3-select': 'Force Awakens Asteroid 3',
    '.core2asteroid4-select': 'Force Awakens Asteroid 4',
    '.core2asteroid5-select': 'Force Awakens Asteroid 5'
  },
  singular: {
    'pilots': 'Pilot',
    'modifications': 'Modification',
    'titles': 'Title'
  },
  types: {
    'Pilot': 'Pilot',
    'Modification': 'Modification',
    'Title': 'Title'
  }
};

if (exportObj.cardLoaders == null) {
  exportObj.cardLoaders = {};
}

exportObj.cardLoaders.English = function() {
  var basic_cards, condition_translations, modification_translations, pilot_translations, title_translations, upgrade_translations;
  exportObj.cardLanguage = 'English';
  basic_cards = exportObj.basicCardData();
  exportObj.canonicalizeShipNames(basic_cards);
  exportObj.ships = basic_cards.ships;
  pilot_translations = {
    "Wedge Antilles": {
      text: "When attacking, reduce the defender's agility value by 1 (to a minimum of \"0\")."
    },
    "Garven Dreis": {
      text: "After spending a focus token, you may place that token on any other friendly ship at Range 1-2 (instead of discarding it)."
    },
    "Biggs Darklighter": {
      text: "Other friendly ships at Range 1 cannot be targeted by attacks if the attacker could target you instead."
    },
    "Luke Skywalker": {
      text: "When defending, you may change 1 of your %FOCUS% results to a %EVADE% result."
    },
    '"Dutch" Vander': {
      text: "After acquiring a target lock, choose another friendly ship at Range 1-2.  The chosen ship may immediately acquire a target lock."
    },
    "Horton Salm": {
      text: "When attacking at Range 2-3, you may reroll any of your blank results."
    },
    '"Winged Gundark"': {
      text: "When attacking at Range 1, you may change 1 of your %HIT% results to a %CRIT% result."
    },
    '"Night Beast"': {
      text: "After executing a green maneuver, you may perform a free focus action."
    },
    '"Backstabber"': {
      text: "When attacking from outside the defender's firing arc, roll 1 additional attack die."
    },
    '"Dark Curse"': {
      text: "When defending, ships attacking you cannot spend focus tokens or reroll attack dice."
    },
    '"Mauler Mithel"': {
      text: "When attacking at Range 1, roll 1 additional attack die."
    },
    '"Howlrunner"': {
      text: "When another friendly ship at Range 1 is attacking with its primary weapon, it may reroll 1 attack die."
    },
    "Maarek Stele": {
      text: "When your attack deals a faceup Damage card to the defender, instead draw 3 Damage cards, choose 1 to deal, and discard the others."
    },
    "Darth Vader": {
      text: "During your \"Perform Action\" step, you may perform 2 actions."
    },
    "\"Fel's Wrath\"": {
      text: "When the number of Damage cards assigned to you equals or exceeds your hull value, you are not destroyed until the end of the Combat phase."
    },
    "Turr Phennir": {
      text: "After you perform an attack, you may perform a free boost or barrel roll action."
    },
    "Soontir Fel": {
      text: "When you receive a stress token, you may assign 1 focus token to your ship."
    },
    "Tycho Celchu": {
      text: "You may perform actions even while you have stress tokens."
    },
    "Arvel Crynyd": {
      text: "You may declare an enemy ship inside your firing arc that you are touching as the target of your attack."
    },
    "Chewbacca": {
      text: "When you are dealt a faceup Damage card, immediately flip it facedown (without resolving its ability)."
    },
    "Lando Calrissian": {
      text: "After you execute a green maneuver, choose 1 other friendly ship at Range 1.  That ship may perform 1 free action shown on its action bar."
    },
    "Han Solo": {
      text: "When attacking, you may reroll all of your dice.  If you choose to do so, you must reroll as many of your dice as possible."
    },
    "Kath Scarlet": {
      text: "When attacking, the defender receives 1 stress token if he cancels at least 1 %CRIT% result."
    },
    "Boba Fett": {
      text: "When you reveal a bank maneuver (%BANKLEFT% or %BANKRIGHT%), you may rotate your dial to the other bank maneuver of the same speed."
    },
    "Krassis Trelix": {
      text: "When attacking with a secondary weapon, you may reroll 1 attack die."
    },
    "Ten Numb": {
      text: "When attacking, 1 of your %CRIT% results cannot be canceled by defense dice."
    },
    "Ibtisam": {
      text: "When attacking or defending, if you have at least 1 stress token, you may reroll 1 of your dice."
    },
    "Roark Garnet": {
      text: 'At the start of the Combat phase, choose 1 other friendly ship at Range 1-3.  Until the end of the phase, treat that ship\'s pilot skill value as "12."'
    },
    "Kyle Katarn": {
      text: "At the start of the Combat phase, you may assign 1 of your focus tokens to another friendly ship at Range 1-3."
    },
    "Jan Ors": {
      text: "When another friendly ship at Range 1-3 is attacking, if you have no stress tokens, you may receive 1 stress token to allow that ship to roll 1 additional attack die."
    },
    "Captain Jonus": {
      text: "When another friendly ship at Range 1 attacks with a secondary weapon, it may reroll up to 2 attack dice."
    },
    "Major Rhymer": {
      text: "When attacking with a secondary weapon, you may increase or decrease the weapon range by 1 to a limit of Range 1-3."
    },
    "Captain Kagi": {
      text: "When an enemy ship acquires a target lock, it must lock onto your ship if able."
    },
    "Colonel Jendon": {
      text: "At the start of the Combat phase, you may assign 1 of your blue target lock tokens to a friendly ship at Range 1 if it does not have a blue target lock token."
    },
    "Captain Yorr": {
      text: "When another friendly ship at Range 1-2 would receive a stress token, if you have 2 or fewer stress tokens, you may receive that token instead."
    },
    "Lieutenant Lorrir": {
      text: "When performing a barrel roll action, you may receive 1 stress token to use the (%BANKLEFT% 1) or (%BANKRIGHT% 1) template instead of the (%STRAIGHT% 1) template."
    },
    "Tetran Cowall": {
      text: "When you reveal a %UTURN% maneuver, you may treat the speed of that maneuver as \"1,\" \"3,\" or \"5\"."
    },
    "Kir Kanos": {
      text: "When attacking at Range 2-3, you may spend 1 evade token to add 1 %HIT% result to your roll."
    },
    "Carnor Jax": {
      text: "Enemy ships at Range 1 cannot perform focus or evade actions and cannot spend focus or evade tokens."
    },
    "Lieutenant Blount": {
      text: "When attacking, the defender is hit by your attack, even if he does not suffer any damage."
    },
    "Airen Cracken": {
      text: "After you perform an attack, you may choose another friendly ship at Range 1.  That ship may perform 1 free action."
    },
    "Colonel Vessery": {
      text: "When attacking, immediately after you roll attack dice, you may acquire a target lock on the defender if it already has a red target lock token."
    },
    "Rexler Brath": {
      text: "After you perform an attack that deals at least 1 Damage card to the defender, you may spend a focus token to flip those cards faceup."
    },
    "Etahn A'baht": {
      text: "When an enemy ship inside your firing arc at Range 1-3 is defending, the attacker may change 1 of its %HIT% results to a %CRIT% result."
    },
    "Corran Horn": {
      text: "At the start of the End phase, you may perform one attack.  You cannot attack during the next round."
    },
    '"Echo"': {
      text: "When you decloak, you must use the (%BANKLEFT% 2) or (%BANKRIGHT% 2) template instead of the (%STRAIGHT% 2) template."
    },
    '"Whisper"': {
      text: "After you perform an attack that hits, you may assign 1 focus to your ship."
    },
    "Wes Janson": {
      text: "After you perform an attack, you may remove 1 focus, evade, or blue target lock token from the defender."
    },
    "Jek Porkins": {
      text: "When you receive a stress token, you may remove it and roll 1 attack die.  On a %HIT% result, deal 1 facedown Damage card to this ship."
    },
    '"Hobbie" Klivian': {
      text: "When you acquire or spend a target lock, you may remove 1 stress token from your ship."
    },
    "Tarn Mison": {
      text: "When an enemy ship declares you as the target of an attack, you may acquire a target lock on that ship."
    },
    "Jake Farrell": {
      text: "After you perform a focus action or are assigned a focus token, you may perform a free boost or barrel roll action."
    },
    "Gemmer Sojan": {
      text: "While you are at Range 1 of at least 1 enemy ship, increase your agility value by 1."
    },
    "Keyan Farlander": {
      text: "When attacking, you may remove 1 stress token to change all of your %FOCUS% results to %HIT%results."
    },
    "Nera Dantels": {
      text: "You can perform %TORPEDO% secondary weapon attacks against enemy ships outside your firing arc."
    },
    "CR90 Corvette (Fore)": {
      text: "When attacking with your primary weapon, you may spend 1 energy to roll 1 additional attack die."
    },
    "Dash Rendar": {
      text: "You may ignore obstacles during the Activation phase and when performing actions."
    },
    '"Leebo"': {
      text: "When you are dealt a faceup Damage card, draw 1 additional Damage card, choose 1 to resolve, and discard the other."
    },
    "Eaden Vrill": {
      text: "When performing a primary weapon attack against a stressed ship, roll 1 additional attack die."
    },
    "Rear Admiral Chiraneau": {
      text: "When attacking at Range 1-2, you may change 1 of your %FOCUS% results to a %CRIT% result."
    },
    "Commander Kenkirk": {
      text: "If you have no shields and at least 1 Damage card assigned to you, increase your agility value by 1."
    },
    "Captain Oicunn": {
      text: "After executing a maneuver, each enemy ship you are touching suffers 1 damage."
    },
    "Prince Xizor": {
      text: "When defending, a friendly ship at Range 1 may suffer 1 uncanceled %HIT% or %CRIT% result instead of you."
    },
    "Guri": {
      text: "At the start of the Combat phase, if you are at Range 1 of an enemy ship, you may assign 1 focus token to your ship."
    },
    "Serissu": {
      text: "When another friendly ship at Range 1 is defending, it may reroll 1 defense die."
    },
    "Laetin A'shera": {
      text: "After you defend against an attack, if the attack did not hit, you may assign 1 evade token to your ship."
    },
    "IG-88A": {
      text: "After you perform an attack that destroys the defender, you may recover 1 shield."
    },
    "IG-88B": {
      text: "Once per round, after you perform an attack that does not hit, you may perform an attack with an equipped %CANNON% secondary weapon."
    },
    "IG-88C": {
      text: "After you perform a boost action, you may perform a free evade action."
    },
    "IG-88D": {
      text: "You may execute the (%SLOOPLEFT% 3) or (%SLOOPRIGHT% 3) maneuver using the corresponding (%TURNLEFT% 3) or (%TURNRIGHT% 3) template."
    },
    "Boba Fett (Scum)": {
      text: "When attacking or defending, you may reroll 1 of your dice for each enemy ship at Range 1."
    },
    "Kath Scarlet (Scum)": {
      text: "When attacking a ship inside your auxiliary firing arc, roll 1 additional attack die."
    },
    "Emon Azzameen": {
      text: "When dropping a bomb, you may use the (%TURNLEFT% 3), (%STRAIGHT% 3), or (%TURNRIGHT% 3) template instead of the (%STRAIGHT% 1) template."
    },
    "Kavil": {
      text: "When attacking a ship outside your firing arc, roll 1 additional attack die."
    },
    "Drea Renthal": {
      text: "After you spend a target lock, you may receive 1 stress token to acquire a target lock."
    },
    "Dace Bonearm": {
      text: "When an enemy ship at Range 1-3 receives at least 1 ion token, if you are not stressed, you may receive 1 stress token to cause that ship to suffer 1 damage."
    },
    "Palob Godalhi": {
      text: "At the start of the Combat phase, you may remove 1 focus or evade token from an enemy ship at Range 1-2 and assign it to yourself."
    },
    "Torkil Mux": {
      text: "At the end of the Activation phase, choose 1 enemy ship at Range 1-2. Until the end of the Combat phase, treat that ship's pilot skill value as \"0\"."
    },
    "N'Dru Suhlak": {
      text: "When attacking, if there are no other friendly ships at Range 1-2, roll 1 additional attack die."
    },
    "Kaa'to Leeachos": {
      text: "At the start of the Combat phase, you may remove 1 focus or evade token from another friendly ship at Range 1-2 and assign it to yourself."
    },
    "Commander Alozen": {
      text: "At the start of the Combat phase, you may acquire a target lock on an enemy ship at Range 1."
    },
    "Raider-class Corvette (Fore)": {
      text: "Once per round, after you perform a primary weapon attack, you may spend 2 energy to perform another primary weapon attack."
    },
    "Bossk": {
      text: "When you perform an attack that hits, before dealing damage, you may cancel 1 of your %CRIT% results to add 2 %HIT% results."
    },
    "Talonbane Cobra": {
      text: "When attacking or defending, double the effect of your range combat bonuses."
    },
    "Miranda Doni": {
      text: "Once per round when attacking, you may either spend 1 shield to roll 1 additional attack die <strong>or</strong> roll 1 fewer attack die to recover 1 shield."
    },
    '"Redline"': {
      text: "You may maintain 2 target locks on the same ship.  When you acquire a target lock, you may acquire a second lock on that ship."
    },
    '"Deathrain"': {
      text: "When dropping a bomb, you may use the front guides of your ship.  After dropping a bomb, you may perform a free barrel roll action."
    },
    "Juno Eclipse": {
      text: "When you reveal your maneuver, you may increase or decrease its speed by 1 (to a minimum of 1)."
    },
    "Zertik Strom": {
      text: "Enemy ships at Range 1 cannot add their range combat bonus when attacking."
    },
    "Lieutenant Colzet": {
      text: "At the start of the End phase, you may spend a target lock you have on an enemy ship to flip 1 random facedown Damage card assigned to it faceup."
    },
    "Latts Razzi": {
      text: "When a friendly ship declares an attack, you may spend a target lock you have on the defender to reduce its agility by 1 for that attack."
    },
    "Graz the Hunter": {
      text: "When defending, if the attacker is inside your firing arc, roll 1 additional defense die."
    },
    "Esege Tuketu": {
      text: "When another friendly ship at Range 1-2 is attacking, it may treat your focus tokens as its own."
    },
    "Moralo Eval": {
      text: "You can perform %CANNON% secondary attacks against ships inside your auxiliary firing arc."
    },
    'Gozanti-class Cruiser': {
      text: "After you execute a maneuver, you may deploy up to 2 attached ships."
    },
    '"Scourge"': {
      text: "When attacking a defender that has 1 or more Damage cards, roll 1 additional attack die."
    },
    "The Inquisitor": {
      text: "When attacking with your primary weapon at Range 2-3, treat the range of the attack as Range 1."
    },
    "Zuckuss": {
      text: "When attacking, you may roll 1 additional attack die.  If you do, the defender rolls 1 additional defense die."
    },
    "Dengar": {
      text: "Once per round after defending, if the attacker is inside your firing arc, you may perform an attack against that ship."
    },
    "Poe Dameron": {
      text: "When attacking or defending, if you have a focus token, you may change 1 of your %FOCUS% results to a %HIT% or %EVADE% result."
    },
    '"Blue Ace"': {
      text: "When performing a boost action, you may use the (%TURNLEFT% 1) or (%TURNRIGHT% 1) template."
    },
    '"Omega Ace"': {
      text: "When attacking, you may spend a focus token and a target lock you have on the defender to change all of your results to %CRIT% results."
    },
    '"Epsilon Leader"': {
      text: "At the start of the Combat phase, remove 1 stress token from each friendly ship at Range 1."
    },
    '"Zeta Ace"': {
      text: "When performing a barrel roll you may use the (%STRAIGHT% 2) template instead of the (%STRAIGHT% 1) template."
    },
    '"Red Ace"': {
      text: 'The first time you remove a shield token from your ship each round, assign 1 evade token to your ship.'
    },
    '"Omega Leader"': {
      text: 'Enemy ships that you have locked cannot modify any dice when attacking you or defending against your attacks.'
    },
    'Hera Syndulla': {
      text: 'When you reveal a green or red maneuver, you may rotate your dial to another maneuver of the same difficulty.'
    },
    '"Youngster"': {
      text: "You may equip Action: EPTs. Friendly TIE fighters at range 1-3 may perform the action on your equipped EPT upgrade card."
    },
    '"Wampa"': {
      text: "When attacking, you may cancel all die results.  If you cancel a %CRIT% result, deal 1 facedown Damage card to the defender."
    },
    '"Chaser"': {
      text: "When another friendly ship at Range 1 spends a focus token, assign a focus token to your ship."
    },
    'Ezra Bridger': {
      text: "When defending, if you are stressed, you may change up to 2 of your %FOCUS% results to %EVADE% results."
    },
    '"Zeta Leader"': {
      text: 'When attacking, if you are not stressed, you may receive 1 stress token to roll 1 additional die.'
    },
    '"Epsilon Ace"': {
      text: 'While you do not have any Damage cards, treat your pilot skill value as "12."'
    },
    "Kanan Jarrus": {
      text: "When an enemy ship at Range 1-2 is attacking, you may spend a focus token.  If you do, the attacker rolls 1 fewer attack die."
    },
    '"Chopper"': {
      text: "At the start of the Combat phase, each enemy ship you are touching receives 1 stress token."
    },
    'Hera Syndulla (Attack Shuttle)': {
      text: "When you reveal a green or red maneuver, you may rotate your dial to another maneuver of the same difficulty."
    },
    'Sabine Wren': {
      text: "Immediately before you reveal your maneuver, you may perform a free boost or barrel roll action."
    },
    '"Zeb" Orrelios': {
      text: 'When defending, you may cancel %CRIT% results before %HIT% results.'
    },
    'Tomax Bren': {
      text: 'You may equip discardable EPTs. Once per round after you discard an EPT upgrade card, flip that card faceup.'
    },
    'Ello Asty': {
      text: 'While you are not stressed, you may treat your %TROLLLEFT% and %TROLLRIGHT% maneuvers as white maneuvers.'
    },
    "Valen Rudor": {
      text: "After defending, you may perform a free action."
    },
    "4-LOM": {
      text: "At the start of the End phase, you may assign 1 of your stress tokens to another ship at Range 1."
    },
    "Tel Trevura": {
      text: "The first time you would be destroyed, instead cancel any remaining damage, discard all Damage cards, and deal 4 facedown Damage cards to this ship."
    },
    "Manaroo": {
      text: "At the start of the Combat phase, you may assign all focus, evade, and target lock tokens assigned to you to another friendly ship at Range 1."
    },
    '"Deathfire"': {
      text: 'When you reveal your maneuver dial or after you perform an action, you may perform a %BOMB% Upgrade card action as a free action.'
    },
    "Maarek Stele (TIE Defender)": {
      text: "When your attack deals a faceup Damage card to the defender, instead draw 3 Damage cards, choose 1 to deal, and discard the others."
    },
    "Countess Ryad": {
      text: "When you reveal a %STRAIGHT% maneuver, you may treat it as a %KTURN% maneuver."
    },
    "Poe Dameron (PS9)": {
      text: "When attacking or defending, if you have a focus token, you may change 1 of your %FOCUS% results to a %HIT% or %EVADE% result."
    },
    "Rey": {
      text: "When attacking or defending, if the enemy ship is inside of your firing arc, you may reroll up to 2 of your blank results."
    },
    'Han Solo (TFA)': {
      text: 'When you are placed during setup, you can be placed anywhere in the play area beyond Range 3 of enemy ships.'
    },
    'Chewbacca (TFA)': {
      text: 'After another friendly ship at Range 1-3 is destroyed (but has not fled the battlefield), you may perform an attack.'
    },
    'Norra Wexley': {
      text: 'When attacking or defending, you may spend a target lock you have on the enemy ship to add 1 %FOCUS% result to your roll.'
    },
    'Shara Bey': {
      text: 'When another friendly ship at Range 1-2 is attacking, it may treat your blue target lock tokens as its own.'
    },
    'Thane Kyrell': {
      text: 'After an enemy ship in your firing arc at Range 1-3 attacks another friendly ship, you may perform a free action.'
    },
    'Braylen Stramm': {
      text: 'After you execute a maneuver, you may roll an attack die.  On a %HIT% or %CRIT% result, remove 1 stress token from your ship.'
    },
    '"Quickdraw"': {
      text: 'Once per round, when you lose a shield token, you may perform a primary weapon attack.'
    },
    '"Backdraft"': {
      text: 'When attacking a ship inside your auxiliary firing arc, you may add 1 %CRIT% result.'
    },
    'Fenn Rau': {
      text: 'When attacking or defending, if the enemy ship is at Range 1, you may roll 1 additional die.'
    },
    'Old Teroch': {
      text: 'At the start of the Combat phase, you may choose 1 enemy ship at Range 1.  If you are inside its firing arc, it discards all focus and evade tokens.'
    },
    'Kad Solus': {
      text: 'After you execute a red maneuver, assign 2 focus tokens to your ship.'
    },
    'Ketsu Onyo': {
      text: 'At the start of the Combat phase, you may choose a ship at Range 1.  If it is inside your primary <strong>and</strong> mobile firing arcs, assign 1 tractor beam token to it.'
    },
    'Asajj Ventress': {
      text: 'At the start of the Combat phase, you may choose a ship at Range 1-2.  If it is inside your mobile firing arc, assign 1 stress token to it.'
    },
    'Sabine Wren (Scum)': {
      text: 'When defending against an enemy ship inside your mobile firing arc at Range 1-2, you may add 1 %FOCUS% result to your roll.'
    },
    'Sabine Wren (TIE Fighter)': {
      text: 'Immediately before you reveal your maneuver, you may perform a free boost or barrel roll action.'
    },
    '"Zeb" Orrelios (TIE Fighter)': {
      text: 'When defending, you may cancel %CRIT% results before %HIT% results.'
    },
    'Kylo Ren': {
      text: 'The first time you are hit by an attack each round, deal the "I\'ll Show You the Dark Side" Condition card to the attacker.'
    },
    'Unkar Plutt': {
      text: 'At the end of the Activation phase, you <strong>must</strong> assign a tractor beam token to each ship you are touching.'
    },
    'Cassian Andor': {
      text: 'At the start of the Activation phase, you may remove 1 stress token from 1 other friendly ship at Range 1-2.'
    },
    'Bodhi Rook': {
      text: 'When a friendly ship acquires a target lock, that ship can lock onto an enemy ship at Range 1-3 of any friendly ship.'
    },
    'Heff Tobber': {
      text: 'After an enemy ship executes a maneuver that causes it to overlap your ship, you may perform a free action.'
    },
    '"Duchess"': {
      text: 'While you have the "Adaptive Ailerons" Upgrade card equipped, you may choose to ignore its card ability.'
    },
    '"Pure Sabacc"': {
      text: 'When attacking, if you have 1 or fewer Damage cards, roll 1 additional attack die.'
    },
    '"Countdown"': {
      text: 'When defending, if you are not stressed, during the "Compare Results" step, you may suffer 1 damage to cancel all dice results.  If you do, receive 1 stress token.'
    },
    'Nien Nunb': {
      text: 'When you receive a stress token, if there is an enemy ship inside your firing arc at Range 1, you may discard that stress token.'
    },
    '"Snap" Wexley': {
      text: 'After you execute a 2-, 3-, or 4-speed maneuver, if you are not touching a ship, you may perform a free boost action.'
    },
    'Jess Pava': {
      text: 'When attacking or defending, you may reroll 1 of your dice for each other friendly ship at Range 1.'
    },
    'Ahsoka Tano': {
      text: 'At the start of the Combat phase, you may spend 1 focus token to choose a friendly ship at Range 1.  It may perform 1 free action.'
    },
    'Captain Rex': {
      text: 'After you perform an attack, assign the "Suppressive Fire" Condition card to the defender.'
    },
    'Major Stridan': {
      text: 'For the purpose of your actions and Upgrade cards, you may treat friendly ships at Range 2-3 as being at Range 1.'
    },
    'Lieutenant Dormitz': {
      text: 'During setup, friendly ships may placed anywhere in the play area at Range 1-2 of you.'
    },
    'Constable Zuvio': {
      text: 'When you reveal a reverse maneuver, you may drop a bomb using your front guides (including a bomb with the "<strong>Action:</strong>" header).'
    },
    'Sarco Plank': {
      text: 'When defending, instead of using your agility value, you may roll a number of defense dice equal to the speed of the maneuver you executed this round.'
    },
    'Genesis Red': {
      text: 'After you acquire a target lock, assign focus and evade tokens to your ship until you have the same number of each token as the locked ship.'
    },
    'Quinn Jast': {
      text: 'At the start of the Combat phase, you may receive a weapons disabled token to flip one of your discarded %TORPEDO% or %MISSILE% Upgrade cards faceup.'
    },
    'Inaldra': {
      text: 'When attacking or defending, you may spend 1 shield to reroll any number of your dice.'
    },
    'Sunny Bounder': {
      text: 'Once per round, after you roll or reroll dice, if you have the same result on each of your dice, add 1 matching result.'
    },
    'Lieutenant Kestal': {
      text: 'When attacking, you may spend 1 focus token to cancel all of the defender\'s blank and %FOCUS% results.'
    },
    '"Double Edge"': {
      text: 'Once per round, after you perform a secondary weapon attack that does not hit, you may perform an attack with a different weapon.'
    },
    'Viktor Hel': {
      text: 'After defending, if you did not roll exactly 2 defense dice, the attacker receives 1 stress token.'
    },
    'Lowhhrick': {
      text: 'When another friendly ship at Range 1 is defending, you may spend 1 reinforce token. If you do, the defender adds 1 %EVADE% result.'
    },
    'Wullffwarro': {
      text: 'When attacking, if you have no shields and at least 1 Damage card assigned to you, roll 1 additional attack die.'
    },
    'Captain Nym (Scum)': {
      text: 'You may ignore friendly bombs. When a friendly ship is defending, if the attacker measures range through a friendly bomb token, the defender may add 1 %EVADE% result.'
    },
    'Captain Nym (Rebel)': {
      text: 'Once per round, you may prevent a friendly bomb from detonating.'
    },
    'Sol Sixxa': {
      text: 'When dropping a bomb, you may use the (%TURNLEFT% 1) or (%TURNRIGHT% 1) template instead of the (%STRAIGHT% 1) template.'
    },
    'Dalan Oberos': {
      text: 'If you are not stressed, when you reveal a turn, bank, or Segnor\'s Loop maneuver, you may instead treat it as a red Tallon Roll maneuver of the same direction (left or right) using the template of the original revealed maneuver.'
    },
    'Thweek': {
      text: 'During setup, before the "Place Forces" step, you may choose 1 enemy ship and assign the "Shadowed" or "Mimicked" Condition card to it.'
    },
    'Captain Jostero': {
      text: 'Once per round, after an enemy ship that is not defending against an attack suffers damage or critical damage, you may perform an attack against that ship.'
    },
    'Major Vynder': {
      text: 'When defending, if you have a weapons disabled token, roll 1 additional defense die.'
    },
    'Torani Kulda': {
      text: 'After you perform an attack, each enemy ship inside your bullseye firing arc at Range 1-3 must choose to suffer 1 damage or remove all of its focus and evade tokens.'
    },
    'Fenn Rau (Sheathipede)': {
      text: 'When an enemy ship inside your firing arc at Range 1-3 becomes the active ship during the Combat phase, if you are not stressed, you may receive 1 stress token.  If you do, that ship cannot spend tokens to modify its dice when attacking this round.'
    },
    '"Crimson Leader"': {
      text: 'When attacking, if the defender is inside your firing arc, you may spend 1 %HIT% or %CRIT% result to assign the "Rattled" Condition to the defender.'
    },
    'Kylo Ren (TIE Silencer)': {
      text: 'The first time you are hit by an attack each round, deal the "I\'ll Show You the Dark Side" Condition card to the attacker.'
    }
  };
  upgrade_translations = {
    "Ion Cannon Turret": {
      text: "<strong>Attack:</strong> Attack 1 ship (even a ship outside your firing arc).%LINEBREAK%If this attack hits the target ship, the ship suffers 1 damage and receives 1 ion token.  Then cancel all dice results."
    },
    "Proton Torpedoes": {
      text: "<strong>Attack (target lock):</strong> Spend your target lock and discard this card to perform this attack.%LINEBREAK%You may change 1 of your %FOCUS% results to a %CRIT% result."
    },
    "R2 Astromech": {
      text: "You may treat all 1- and 2-speed maneuvers as green maneuvers."
    },
    "R2-D2": {
      text: "After executing a green maneuver, you may recover 1 shield (up to your shield value)."
    },
    "R2-F2": {
      text: "<strong>Action:</strong> Increase your agility value by 1 until the end of this game round."
    },
    "R5-D8": {
      text: "<strong>Action:</strong> Roll 1 defense die.%LINEBREAK%On a %EVADE% or %FOCUS% result, discard 1 of your facedown Damage cards."
    },
    "R5-K6": {
      text: "After spending your target lock, roll 1 defense die.%LINEBREAK%On a %EVADE% result, immediately acquire a target lock on that same ship.  You cannot spend this target lock during this attack."
    },
    "R5 Astromech": {
      text: "During the End phase, you may choose 1 of your faceup Damage cards with the Ship trait and flip it facedown."
    },
    "Determination": {
      text: "When you are dealt a faceup Damage card with the Pilot trait, discard it immediately without resolving its effect."
    },
    "Swarm Tactics": {
      text: "At the start of the Combat phase, you may choose 1 friendly ship at Range 1.%LINEBREAK%Until the end of this phase, treat the chosen ship as if its pilot skill were equal to your pilot skill."
    },
    "Squad Leader": {
      text: "<strong>Action:</strong> Choose 1 ship at Range 1-2 that has a lower pilot skill than you.%LINEBREAK%The chosen ship may immediately perform 1 free action."
    },
    "Expert Handling": {
      text: "<strong>Action:</strong> Perform a free barrel roll action.  If you do not have the %BARRELROLL% action icon, receive 1 stress token.%LINEBREAK%You may then remove 1 enemy target lock from your ship."
    },
    "Marksmanship": {
      text: "<strong>Action:</strong> When attacking this round, you may change 1 of your %FOCUS% results to a %CRIT% result and all of your other %FOCUS% results to %HIT% results."
    },
    "Concussion Missiles": {
      text: "<strong>Attack (target lock):</strong>  Spend your target lock and discard this card to perform this attack.%LINEBREAK%You may change 1 of your blank results to a %HIT% result."
    },
    "Cluster Missiles": {
      text: "<strong>Attack (target lock):</strong> Spend your target lock and discard this card to perform this attack twice."
    },
    "Daredevil": {
      text: "<strong>Action:</strong> Execute a white (%TURNLEFT% 1) or (%TURNRIGHT% 1) maneuver.  Then, receive 1 stress token.%LINEBREAK%Then, if you do not have the %BOOST% action icon, roll 2 attack dice.  Suffer any damage (%HIT%) and any critical damage (%CRIT%) rolled."
    },
    "Elusiveness": {
      text: "When defending, you may receive 1 stress token to choose 1 attack die.  The attacker must reroll that die.%LINEBREAK%If you have at least 1 stress token, you cannot use this ability."
    },
    "Homing Missiles": {
      text: "<strong>Attack (target lock):</strong> Discard this card to perform this attack.%LINEBREAK%The defender cannot spend evade tokens during this attack."
    },
    "Push the Limit": {
      text: "Once per round, after you perform an action, you may perform 1 free action shown in your action bar.%LINEBREAK%Then receive 1 stress token."
    },
    "Deadeye": {
      text: "%SMALLSHIPONLY%%LINEBREAK%You may treat the <strong>Attack (target lock):</strong> header as <strong>Attack (focus):</strong>.%LINEBREAK%When an attack instructs you to spend a target lock, you may spend a focus token instead."
    },
    "Expose": {
      text: "<strong>Action:</strong> Until the end of the round, increase your primary weapon value by 1 and decrease your agility value by 1."
    },
    "Gunner": {
      text: "After you perform an attack that does not hit, you may immediately perform a primary weapon attack.  You cannot perform another attack this round."
    },
    "Ion Cannon": {
      text: "<strong>Attack:</strong> Attack 1 ship.%LINEBREAK%If this attack hits, the defender suffers 1 damage and receives 1 ion token.  Then cancel all dice results."
    },
    "Heavy Laser Cannon": {
      text: "<strong>Attack:</strong> Attack 1 ship.%LINEBREAK%Immediately after rolling your attack dice, you must change all of your %CRIT% results to %HIT% results."
    },
    "Seismic Charges": {
      text: "When you reveal your maneuver dial, you may discard this card to drop 1 seismic charge token.%LINEBREAK%This token detonates at the end of the Activation phase.%LINEBREAK%<strong>Seismic Charge Token:</strong> When this bomb token detonates, each ship at Range 1 of the token suffers 1 damage.  Then discard this token."
    },
    "Mercenary Copilot": {
      text: "When attacking at Range 3, you may change 1 of your %HIT% results to a %CRIT% result."
    },
    "Assault Missiles": {
      text: "<strong>Attack (target lock):</strong> Spend your target lock and discard this card to perform this attack.%LINEBREAK%If this attack hits, each other ship at Range 1 of the defender suffers 1 damage."
    },
    "Veteran Instincts": {
      text: "Increase your pilot skill value by 2."
    },
    "Proximity Mines": {
      text: "<strong>Action:</strong> Discard this card to <strong>drop</strong> 1 proximity mine token.%LINEBREAK%When a ship's base or maneuver template overlaps this token, this token <strong>detonates</strong>.%LINEBREAK%<strong>Proximity Mine Token:</strong> When this bomb token detonates, the ship that moved through or overlapped this token rolls 3 attack dice and suffers all damage (%HIT%) and critical damage (%CRIT%) rolled.  Then discard this token."
    },
    "Weapons Engineer": {
      text: "You may maintain 2 target locks (only 1 per enemy ship).%LINEBREAK%When you acquire a target lock, you may lock onto 2 different ships."
    },
    "Draw Their Fire": {
      text: "When a friendly ship at Range 1 is hit by an attack, you may suffer 1 of the uncanceled %CRIT% results instead of the target ship."
    },
    "Luke Skywalker": {
      text: "%REBELONLY%%LINEBREAK%After you perform an attack that does not hit, you may immediately perform a primary weapon attack.  You may change 1 %FOCUS% result to a %HIT% result.  You cannot perform another attack this round."
    },
    "Nien Nunb": {
      text: "%REBELONLY%%LINEBREAK%You may treat all %STRAIGHT% maneuvers as green maneuvers."
    },
    "Chewbacca": {
      text: "%REBELONLY%%LINEBREAK%When you are dealt a Damage card, you may immediately discard that card and recover 1 shield.%LINEBREAK%Then, discard this Upgrade card."
    },
    "Advanced Proton Torpedoes": {
      text: "<strong>Attack (target lock):</strong> Spend your target lock and discard this card to perform this attack.%LINEBREAK%You may change up to 3 of your blank results to %FOCUS% results."
    },
    "Autoblaster": {
      text: "<strong>Attack:</strong> Attack 1 ship.%LINEBREAK%Your %HIT% results cannot be canceled by defense dice.%LINEBREAK%The defender may cancel %CRIT% results before %HIT% results."
    },
    "Fire-Control System": {
      text: "After you perform an attack, you may acquire a target lock on the defender."
    },
    "Blaster Turret": {
      text: "<strong>Attack (focus):</strong> Spend 1 focus token to perform this attack against 1 ship (even a ship outside your firing arc)."
    },
    "Recon Specialist": {
      text: "When you perform a focus action, assign 1 additional focus token to your ship."
    },
    "Saboteur": {
      text: "<strong>Action:</strong> Choose 1 enemy ship at Range 1 and roll 1 attack die.  On a %HIT% or %CRIT% result, choose 1 random facedown Damage card assigned to that ship, flip it faceup, and resolve it."
    },
    "Intelligence Agent": {
      text: "At the start of the Activation phase, choose 1 enemy ship at Range 1-2.  You may look at that ship's chosen maneuver."
    },
    "Proton Bombs": {
      text: "When you reveal your maneuver dial, you may discard this card to <strong>drop</strong> 1 proton bomb token.%LINEBREAK%This token <strong>detonates</strong> at the end of the Activation phase.%LINEBREAK%<strong>Proton Bomb Token:</strong> When this bomb token detonates, deal 1 <strong>faceup</strong> Damage card to each ship at Range 1 of the token.  Then discard this token."
    },
    "Adrenaline Rush": {
      text: "When you reveal a red maneuver, you may discard this card to treat that maneuver as a white maneuver until the end of the Activation phase."
    },
    "Advanced Sensors": {
      text: "Immediately before you reveal your maneuver, you may perform 1 free action.%LINEBREAK%If you use this ability, you must skip your \"Perform Action\" step during this round."
    },
    "Sensor Jammer": {
      text: "When defending, you may change 1 of the attacker's %HIT% results into a %FOCUS% result.%LINEBREAK%The attacker cannot reroll the die with the changed result."
    },
    "Darth Vader": {
      text: "%IMPERIALONLY%%LINEBREAK%After you perform an attack against an enemy ship, you may suffer 2 damage to cause that ship to suffer 1 critical damage."
    },
    "Rebel Captive": {
      text: "%IMPERIALONLY%%LINEBREAK%Once per round, the first ship that declares you as the target of an attack immediately receives 1 stress token."
    },
    "Flight Instructor": {
      text: "When defending, you may reroll 1 of your %FOCUS% results.  If the attacker's pilot skill value is \"2\" or lower, you may reroll 1 of your blank results instead."
    },
    "Navigator": {
      text: "When you reveal a maneuver, you may rotate your dial to another maneuver with the same bearing.%LINEBREAK%You cannot rotate to a red maneuver if you have any stress tokens."
    },
    "Opportunist": {
      text: "When attacking, if the defender does not have any focus or evade tokens, you may receive 1 stress token to roll 1 additional attack die.%LINEBREAK%You cannot use this ability if you have any stress tokens."
    },
    "Comms Booster": {
      text: "<strong>Energy:</strong> Spend 1 energy to remove all stress tokens from a friendly ship at Range 1-3.  Then assign 1 focus token to that ship."
    },
    "Slicer Tools": {
      text: "<strong>Action:</strong> Choose 1 or more ships at Range 1-3 that have a stress token.  For each ship chosen, you may spend 1 energy to cause that ship to suffer 1 damage."
    },
    "Shield Projector": {
      text: "When an enemy ship is declaring either a small or large ship as the target of its attack, you may spend 3 energy to force that ship to target you if possible."
    },
    "Ion Pulse Missiles": {
      text: "<strong>Attack (target lock):</strong> Discard this card to perform this attack.%LINEBREAK%If this attack hits, the defender suffers 1 damage and receives 2 ion tokens.  Then cancel <strong>all</strong> dice results."
    },
    "Wingman": {
      text: "At the start of the Combat phase, remove 1 stress token from another friendly ship at Range 1."
    },
    "Decoy": {
      text: "At the start of the Combat phase, you may choose 1 friendly ship at Range 1-2.  Exchange your pilot skill with that ship's pilot skill until the end of the phase."
    },
    "Outmaneuver": {
      text: "When attacking a ship inside your firing arc, if you are not inside that ship's firing arc, reduce its agility value by 1 (to a minimum of 0)."
    },
    "Predator": {
      text: "When attacking, you may reroll 1 attack die.  If the defender's pilot skill value is \"2\" or lower, you may instead reroll up to 2 attack dice."
    },
    "Flechette Torpedoes": {
      text: "<strong>Attack (target lock):</strong> Discard this card and spend your target lock to perform this attack.%LINEBREAK%After you perform this attack, the defender receives 1 stress token if its hull value is \"4\" or lower."
    },
    "R7 Astromech": {
      text: "Once per round when defending, if you have a target lock on the attacker, you may spend the target lock to choose any or all attack dice.  The attacker must reroll the chosen dice."
    },
    "R7-T1": {
      text: "<strong>Action:</strong> Choose an enemy ship at Range 1-2.  If you are inside that ship's firing arc, you may acquire a target lock on that ship.  Then, you may perform a free boost action."
    },
    "Tactician": {
      text: "After you perform an attack against a ship inside your firing arc at Range 2, that ship receives 1 stress token."
    },
    "R2-D2 (Crew)": {
      text: "%REBELONLY%%LINEBREAK%At the end of the End phase, if you have no shields, you may recover 1 shield and roll 1 attack die.  On a %HIT% result, randomly flip 1 of your facedown Damage cards faceup and resolve it."
    },
    "C-3PO": {
      text: "%REBELONLY%%LINEBREAK%Once per round, before you roll 1 or more defense dice, you may guess aloud a number of %EVADE% results.  If you roll that many %EVADE% results (before modifying dice), add 1 %EVADE% result."
    },
    "Single Turbolasers": {
      text: "<strong>Attack (Energy):</strong> Spend 2 energy from this card to perform this attack.  The defender doubles his agility value against this attack.  You may change 1 of your %FOCUS% results to a %HIT% result."
    },
    "Quad Laser Cannons": {
      text: "<strong>Attack (Energy):</strong> Spend 1 energy from this card to perform this attack.  If this attack does not hit, you may immediately spend 1 energy from this card to perform this attack again."
    },
    "Tibanna Gas Supplies": {
      text: "<strong>Energy:</strong> You may discard this card to gain 3 energy."
    },
    "Ionization Reactor": {
      text: "<strong>Energy:</strong> Spend 5 energy from this card and discard this card to cause each other ship at Range 1 to suffer 1 damage and receive 1 ion token."
    },
    "Engine Booster": {
      text: "Immediately before you reveal your maneuver dial, you may spend 1 energy to execute a white (%STRAIGHT% 1) maneuver.  You cannot use this ability if you would overlap another ship."
    },
    "R3-A2": {
      text: "When you declare the target of your attack, if the defender is inside your firing arc, you may receive 1 stress token to cause the defender to receive 1 stress token."
    },
    "R2-D6": {
      text: "Your upgrade bar gains the %ELITE% upgrade icon.%LINEBREAK%You cannot equip this upgrade if you already have a %ELITE% upgrade icon or if your pilot skill value is \"2\" or lower."
    },
    "Enhanced Scopes": {
      text: "During the Activation phase, treat your pilot skill value as \"0\"."
    },
    "Chardaan Refit": {
      text: "<span class=\"card-restriction\">A-Wing only.</span>%LINEBREAK%This card has a negative squad point cost."
    },
    "Proton Rockets": {
      text: "<strong>Attack (Focus):</strong> Discard this card to perform this attack.%LINEBREAK%You may roll additional attack dice equal to your agility value, to a maximum of 3 additional dice."
    },
    "Kyle Katarn": {
      text: "%REBELONLY%%LINEBREAK%After you remove a stress token from your ship, you may assign a focus token to your ship."
    },
    "Jan Ors": {
      text: "%REBELONLY%%LINEBREAK%Once per round, when a friendly ship at Range 1-3 performs a focus action or would be assigned a focus token, you may assign it an evade token instead."
    },
    "Toryn Farr": {
      text: "%HUGESHIPONLY% %REBELONLY%%LINEBREAK%<strong>Action:</strong> Spend any amount of energy to choose that many enemy ships at Range 1-2.  Remove all focus, evade, and blue target lock tokens from those ships."
    },
    "R4-D6": {
      text: "When you are hit by an attack and there are at least 3 uncanceled %HIT% results, you may choose to cancel those results until there are 2 remaining.  For each result canceled this way, receive 1 stress token."
    },
    "R5-P9": {
      text: "At the end of the Combat phase, you may spend 1 of your focus tokens to recover 1 shield (up to your shield value)."
    },
    "WED-15 Repair Droid": {
      text: "%HUGESHIPONLY%%LINEBREAK%<strong>Action:</strong> Spend 1 energy to discard 1 of your facedown Damage cards, or spend 3 energy to discard 1 of your faceup Damage cards."
    },
    "Carlist Rieekan": {
      text: "%HUGESHIPONLY% %REBELONLY%%LINEBREAK%At the start of the Activation phase, you may discard this card to treat each friendly ship's pilot skill value as \"12\" until the end of the phase."
    },
    "Jan Dodonna": {
      text: "%HUGESHIPONLY% %REBELONLY%%LINEBREAK%When another friendly ship at Range 1 is attacking, it may change 1 of its %HIT% results to a %CRIT%."
    },
    "Expanded Cargo Hold": {
      text: "<span class=\"card-restriction\">GR-75 only.</span>%LINEBREAK%Once per round, when you would be dealt a faceup Damage card, you may draw that card from either the fore or aft Damage deck."
    },
    "Backup Shield Generator": {
      text: "At the end of each round, you may spend 1 energy to recover 1 shield (up to your shield value)."
    },
    "EM Emitter": {
      text: "When you obstruct an attack, the defender rolls 3 additional defense dice (instead of 1)."
    },
    "Frequency Jammer": {
      text: "When you perform a jam action, choose 1 enemy ship that does not have a stress token and is at Range 1 of the jammed ship.  The chosen ship receives 1 stress token."
    },
    "Han Solo": {
      text: "%REBELONLY%%LINEBREAK%When attacking, if you have a target lock on the defender, you may spend that target lock to change all of your %FOCUS% results to %HIT% results."
    },
    "Leia Organa": {
      text: "%REBELONLY%%LINEBREAK%At the start of the Activation phase, you may discard this card to allow all friendly ships that reveal a red maneuver to treat that maneuver as a white maneuver until the end of the phase."
    },
    "Targeting Coordinator": {
      text: "<strong>Energy:</strong> You may spend 1 energy to choose 1 friendly ship at Range 1-2.  Acquire a target lock, then assign the blue target lock token to the chosen ship."
    },
    "Raymus Antilles": {
      text: "%HUGESHIPONLY% %REBELONLY%%LINEBREAK%At the start of the Activation phase, choose 1 enemy ship at Range 1-3.  You may look at that ship's chosen maneuver.  If the maneuver is white, assign that ship 1 stress token."
    },
    "Gunnery Team": {
      text: "Once per round, when attacking with a secondary weapon, you may spend 1 energy to change 1 of your blank results to a %HIT% result."
    },
    "Sensor Team": {
      text: "When acquiring a target lock, you may lock onto an enemy ship at Range 1-5 instead of 1-3."
    },
    "Engineering Team": {
      text: "During the Activation phase, when you reveal a %STRAIGHT% maneuver, gain 1 additional energy during the \"Gain Energy\" step."
    },
    "Lando Calrissian": {
      text: "%REBELONLY%%LINEBREAK%<strong>Action:</strong> Roll 2 defense dice.  For each %FOCUS% result, assign 1 focus token to your ship.  For each %EVADE% result, assign 1 evade token to your ship."
    },
    "Mara Jade": {
      text: "%IMPERIALONLY%%LINEBREAK%At the end of the Combat phase, each enemy ship at Range 1 that does not have a stress token receives 1 stress token."
    },
    "Fleet Officer": {
      text: "%IMPERIALONLY%%LINEBREAK%<strong>Action:</strong> Choose up to 2 friendly ships at Range 1-2 and assign 1 focus token to each of those ships.  Then receive 1 stress token."
    },
    "Lone Wolf": {
      text: "When attacking or defending, if there are no other friendly ships at Range 1-2, you may reroll 1 of your blank results."
    },
    "Stay On Target": {
      text: "When you reveal a maneuver, you may rotate your dial to another maneuver with the same speed.%LINEBREAK%Treat that maneuver as a red maneuver."
    },
    "Dash Rendar": {
      text: "%REBELONLY%%LINEBREAK%You may perform attacks while overlapping an obstacle.%LINEBREAK%Your attacks cannot be obstructed."
    },
    '"Leebo"': {
      text: "%REBELONLY%%LINEBREAK%<strong>Action:</strong> Perform a free boost action.  Then receive 1 ion token."
    },
    "Ruthlessness": {
      text: "%IMPERIALONLY%%LINEBREAK%After you perform an attack that hits, you <strong>must</strong> choose 1 other ship at Range 1 of the defender (other than yourself).  That ship suffers 1 damage."
    },
    "Intimidation": {
      text: "While you are touching an enemy ship, reduce that ship's agility value by 1."
    },
    "Ysanne Isard": {
      text: "%IMPERIALONLY%%LINEBREAK%At the start of the Combat phase, if you have no shields and at least 1 Damage card assigned to your ship, you may perform a free evade action."
    },
    "Moff Jerjerrod": {
      text: "%IMPERIALONLY%%LINEBREAK%When you are dealt a faceup Damage card, you may discard this Upgrade card or another %CREW% Upgrade card to flip that Damage card facedown (without resolving its effect)."
    },
    "Ion Torpedoes": {
      text: "<strong>Attack (target lock):</strong> Spend your target lock and discard this card to perform this attack.%LINEBREAK%If this attack hits, the defender and each ship at Range 1 of it receives 1 ion token."
    },
    "Bodyguard": {
      text: "%SCUMONLY%%LINEBREAK%At the start of the Combat phase, you may spend a focus token to choose a friendly ship at Range 1 with higher pilot skill than you. Increase its agility value by 1 until the end of the round."
    },
    "Calculation": {
      text: "When attacking, you may spend a focus token to change 1 of your %FOCUS% results to a %CRIT% result."
    },
    "Accuracy Corrector": {
      text: "When attacking, during the \"Modify Attack Dice\" step, you may cancel all of your dice results. Then, you may add 2 %HIT% results to your roll.%LINEBREAK%Your dice cannot be modified again during this attack."
    },
    "Inertial Dampeners": {
      text: "When you reveal your maneuver, you may discard this card to instead perform a white (0 %STOP%) maneuver. Then receive 1 stress token."
    },
    "Flechette Cannon": {
      text: "<strong>Attack:</strong> Attack 1 ship.%LINEBREAK%If this attack hits, the defender suffers 1 damage and, if the defender is not stressed, it also receives 1 stress token.  Then cancel <strong>all</strong> dice results."
    },
    '"Mangler" Cannon': {
      text: "<strong>Attack:</strong> Attack 1 ship.%LINEBREAK%When attacking, you may change 1 of your %HIT% results to a %CRIT% result."
    },
    "Dead Man's Switch": {
      text: "When you are destroyed, each ship at Range 1 suffers 1 damage."
    },
    "Feedback Array": {
      text: "During the Combat phase, instead of performing any attacks, you may receive 1 ion token and suffer 1 damage to choose 1 enemy ship at Range 1.  That ship suffers 1 damage."
    },
    '"Hot Shot" Blaster': {
      text: "<strong>Attack:</strong> Discard this card to attack 1 ship (even a ship outside your firing arc)."
    },
    "Greedo": {
      text: "%SCUMONLY%%LINEBREAK%The first time you attack each round and the first time you defend each round, the first Damage card dealt is dealt faceup."
    },
    "Salvaged Astromech": {
      text: "When you are dealt a faceup Damage card with the <strong>Ship</strong> trait, you may immediately discard that card (before resolving its effect).%LINEBREAK%Then, discard this Upgrade card."
    },
    "Bomb Loadout": {
      text: "<span class=\"card-restriction\">Y-Wing only.</span>%LINEBREAK%Your upgrade bar gains the %BOMB% icon."
    },
    '"Genius"': {
      text: "If you are equipped with a bomb that can be dropped when you reveal your maneuver, you may drop the bomb <strong>after</strong> you execute your maneuver instead."
    },
    "Unhinged Astromech": {
      text: "You may treat all 3-speed maneuvers as green maneuvers."
    },
    "R4-B11": {
      text: "When attacking, if you have a target lock on the defender, you may spend the target lock to choose any or all defense dice. The defender must reroll the chosen dice."
    },
    "Autoblaster Turret": {
      text: "<strong>Attack:</strong> Attack 1 ship (even a ship outside your firing arc).%LINEBREAK%Your %HIT% results cannot be canceled by defense dice. The defender may cancel %CRIT% results before %HIT% results."
    },
    "R4 Agromech": {
      text: "When attacking, after you spend a focus token, you may acquire a target lock on the defender."
    },
    "K4 Security Droid": {
      text: "%SCUMONLY%%LINEBREAK%After executing a green maneuver, you may acquire a target lock."
    },
    "Outlaw Tech": {
      text: "%SCUMONLY%%LINEBREAK%After you execute a red maneuver, you may assign 1 focus token to your ship."
    },
    "Advanced Targeting Computer": {
      text: "<span class=\"card-restriction\">TIE Advanced only.</span>%LINEBREAK%When attacking with your primary weapon, if you have a target lock on the defender, you may add 1 %CRIT% result to your roll.  If you do, you cannot spend target locks during this attack."
    },
    "Ion Cannon Battery": {
      text: "<strong>Attack (energy):</strong> Spend 2 energy from this card to perform this attack.  If this attack hits, the defender suffers 1 critical damage and receives 1 ion token.  Then cancel <strong>all</strong> dice results."
    },
    "Extra Munitions": {
      text: "When you equip this card, place 1 ordnance token on each equipped %TORPEDO%, %MISSILE%, and %BOMB% Upgrade card.  When you are instructed to discard an Upgrade card, you may discard 1 ordnance token on that card instead."
    },
    "Cluster Mines": {
      text: "<strong>Action:</strong> Discard this card to <strong>drop</strong> 3 cluster mine tokens.<br /><br />When a ship's base or maneuver template overlaps a cluster mine token, that token <strong>detonates</strong>.<br /><br /><strong>Cluster Mines Tokens:</strong> When one of these bomb tokens detonates, the ship that moved through or overlapped this token rolls 2 attack dice and suffers 1 damage for each %HIT% and %CRIT% rolled.  Then discard that token."
    },
    "Glitterstim": {
      text: "At the start of the Combat phase, you may discard this card and receive 1 stress token.  If you do, until the end of the round, when attacking  or defending, you may change all of your %FOCUS% results to %HIT% or %EVADE% results."
    },
    "Grand Moff Tarkin": {
      text: "%HUGESHIPONLY% %IMPERIALONLY%%LINEBREAK%At the start of the Combat phase, you may choose another ship at Range 1-4.  Either remove 1 focus token from the chosen ship or assign 1 focus token to that ship."
    },
    "Captain Needa": {
      text: "%HUGESHIPONLY% %IMPERIALONLY%%LINEBREAK%If you overlap an obstacle during the Activation phase, do not suffer 1 faceup damage card.  Instead, roll 1 attack die.  On a %HIT% or %CRIT% result, suffer 1 damage."
    },
    "Admiral Ozzel": {
      text: "%HUGESHIPONLY% %IMPERIALONLY%%LINEBREAK%<strong>Energy:</strong> You may remove up to 3 shields from your ship.  For each shield removed, gain 1 energy."
    },
    "Emperor Palpatine": {
      text: "%IMPERIALONLY%%LINEBREAK%Once per round, before a friendly ship rolls dice, you may name a die result. After rolling, you must change 1 of your dice results to the named result. That die result cannot be modified again."
    },
    "Bossk": {
      text: "%SCUMONLY%%LINEBREAK%After you perform an attack that does not hit, if you are not stressed, you <strong>must</strong> receive 1 stress token. Then assign 1 focus token to your ship and acquire a target lock on the defender."
    },
    "Lightning Reflexes": {
      text: "%SMALLSHIPONLY%%LINEBREAK%After you execute a white or green maneuver on your dial, you may discard this card to rotate your ship 180&deg;.  Then receive 1 stress token <strong>after</strong> the \"Check Pilot Stress\" step."
    },
    "Twin Laser Turret": {
      text: "<strong>Attack:</strong> Perform this attack <strong>twice</strong> (even against a ship outside your firing arc).<br /><br />Each time this attack hits, the defender suffers 1 damage.  Then cancel <strong>all</strong> dice results."
    },
    "Plasma Torpedoes": {
      text: "<strong>Attack (target lock):</strong> Spend your target lock and discard this card to perform this attack.<br /><br />If this attack hits, after dealing damage, remove 1 shield token from the defender."
    },
    "Ion Bombs": {
      text: "When you reveal your maneuver dial, you may discard this card to <strong>drop</strong> 1 ion bomb token.<br /><br />This token <strong>detonates</strong> at the end of the Activation phase.<br /><br /><strong>Ion Bombs Token:</strong> When this bomb token detonates, each ship at Range 1 of the token receives 2 ion tokens.  Then discard this token."
    },
    "Conner Net": {
      text: "<strong>Action:</strong> Discard this card to <strong>drop</strong> 1 Conner Net token.<br /><br />When a ship's base or maneuver template overlaps this token, this token <strong>detonates</strong>.<br /><br /><strong>Conner Net Token:</strong> When this bomb token detonates, the ship that moved through or overlapped this token suffers 1 damage, receives 2 ion tokens, and skips its \"Perform Action\" step.  Then discard this token."
    },
    "Bombardier": {
      text: "When dropping a bomb, you may use the (%STRAIGHT% 2) template instead of the (%STRAIGHT% 1) template."
    },
    'Crack Shot': {
      text: 'When attacking a ship inside your firing arc, at the start of the "Compare Results" step, you may discard this card to cancel 1 of the defender\'s %EVADE% results.'
    },
    "Advanced Homing Missiles": {
      text: "<strong>Attack (target lock):</strong> Discard this card to perform this attack.%LINEBREAK%If this attack hits, deal 1 faceup Damage card to the defender.  Then cancel <strong>all</strong> dice results."
    },
    'Agent Kallus': {
      text: '%IMPERIALONLY%%LINEBREAK%At the start of the first round, choose 1 enemy small or large ship.  When attacking or defending against that ship, you may change 1 of your %FOCUS% results to a %HIT% or %EVADE% result.'
    },
    'XX-23 S-Thread Tracers': {
      text: "<strong>Attack (focus):</strong> Discard this card to perform this attack.  If this attack hits, each friendly ship at Range 1-2 of you may acquire a target lock on the defender.  Then cancel <strong>all</strong> dice results."
    },
    "Tractor Beam": {
      text: "<strong>Attack:</strong> Attack 1 ship.%LINEBREAK%If this attack hits, the defender receives 1 tractor beam token.  Then cancel <strong>all</strong> dice results."
    },
    "Cloaking Device": {
      text: "%SMALLSHIPONLY%%LINEBREAK%<strong>Action:</strong> Perform a free cloak action.%LINEBREAK%At the end of each round, if you are cloaked, roll 1 attack die.  On a %FOCUS% result, discard this card, then decloak or discard your cloak token."
    },
    "Shield Technician": {
      text: "%HUGESHIPONLY%%LINEBREAK%When you perform a recover action, instead of spending all of your energy, you can choose any amount of energy to spend."
    },
    "Weapons Guidance": {
      text: "When attacking, you may spend a focus token to change 1 of your blank results to a %HIT% result."
    },
    "BB-8": {
      text: "When you reveal a green maneuver, you may perform a free barrel roll action."
    },
    "R5-X3": {
      text: "Before you reveal your maneuver, you may discard this card to ignore obstacles until the end of the round."
    },
    "Wired": {
      text: "When attacking or defending, if you are stressed, you may reroll 1 or more of your %FOCUS% results."
    },
    'Cool Hand': {
      text: 'When you receive a stress token, you may discard this card to assign 1 focus or evade token to your ship.'
    },
    'Juke': {
      text: '%SMALLSHIPONLY%%LINEBREAK%When attacking, if you have an evade token, you may change 1 of the defender\'s %EVADE% results into a %FOCUS% result.'
    },
    'Comm Relay': {
      text: 'You cannot have more than 1 evade token.%LINEBREAK%During the End phase, do not remove an unused evade token from your ship.'
    },
    'Dual Laser Turret': {
      text: '%GOZANTIONLY%%LINEBREAK%<strong>Attack (energy):</strong> Spend 1 energy from this card to perform this attack against 1 ship (even a ship outside your firing arc).'
    },
    'Broadcast Array': {
      text: '%GOZANTIONLY%%LINEBREAK%Your action bar gains the %JAM% action icon.'
    },
    'Rear Admiral Chiraneau': {
      text: '%HUGESHIPONLY% %IMPERIALONLY%%LINEBREAK%<strong>Action:</strong> Execute a white (%STRAIGHT% 1) maneuver.'
    },
    'Ordnance Experts': {
      text: 'Once per round, when a friendly ship at Range 1-3 performs an attack with a %TORPEDO% or %MISSILE% secondary weapon, it may change 1 of its blank results to a %HIT% result.'
    },
    'Docking Clamps': {
      text: '%GOZANTIONLY% %LIMITED%%LINEBREAK%You may attach up to 4 TIE fighters, TIE interceptors, TIE bombers, or TIE Advanced to this ship.  All attached ships must have the same ship type.'
    },
    '"Zeb" Orrelios': {
      text: "%REBELONLY%%LINEBREAK%Enemy ships inside your firing arc that you are touching are not considered to be touching you when either you or they activate during the Combat phase."
    },
    'Kanan Jarrus': {
      text: "%REBELONLY%%LINEBREAK%Once per round, after a friendly ship at Range 1-2 executes a white maneuver, you may remove 1 stress token from that ship."
    },
    'Reinforced Deflectors': {
      text: "%LARGESHIPONLY%%LINEBREAK%After defending, if you suffered a combination of 3 or more damage and critical damage during the attack, recover 1 shield (up to your shield value)."
    },
    'Dorsal Turret': {
      text: "<strong>Attack:</strong> Attack 1 ship (even a ship outside your firing arc).%LINEBREAK%If the target of this attack is at Range 1, roll 1 additional attack die."
    },
    'Targeting Astromech': {
      text: 'After you execute a red maneuver, you may acquire a target lock.'
    },
    'Hera Syndulla': {
      text: "%REBELONLY%%LINEBREAK%You may reveal and execute red maneuvers even while you are stressed."
    },
    'Ezra Bridger': {
      text: "%REBELONLY%%LINEBREAK%When attacking, if you are stressed, you may change 1 of your %FOCUS% results to a %CRIT% result."
    },
    'Sabine Wren': {
      text: "%REBELONLY%%LINEBREAK%Your upgrade bar gains the %BOMB% upgrade icon.  Once per round, before a friendly bomb token is removed, choose 1 enemy ship at Range 1 of that token. That ship suffers 1 damage."
    },
    '"Chopper"': {
      text: "%REBELONLY%%LINEBREAK%You may perform actions even while you are stressed.%LINEBREAK%After you perform an action while you are stressed, suffer 1 damage."
    },
    'Construction Droid': {
      text: '%HUGESHIPONLY% %LIMITED%%LINEBREAK%When you perform a recover action, you may spend 1 energy to discard 1 facedown Damage card.'
    },
    'Cluster Bombs': {
      text: 'After defending, you may discard this card.  If you do, each other ship at Range 1 of the defending section rolls 2 attack dice, suffering all damage (%HIT%) and critical damage (%CRIT%) rolled.'
    },
    "Adaptability": {
      text: "<span class=\"card-restriction\">Dual card.</span>%LINEBREAK%<strong>Side A:</strong> Increase your pilot skill value by 1.%LINEBREAK%<strong>Side B:</strong> Decrease your pilot skill value by 1."
    },
    "Electronic Baffle": {
      text: "When you receive a stress token or an ion token, you may suffer 1 damage to discard that token."
    },
    "4-LOM": {
      text: "%SCUMONLY%%LINEBREAK%When attacking, during the \"Modify Attack Dice\" step, you may receive 1 ion token to choose 1 of the defender's focus or evade tokens.  That token cannot be spent during this attack."
    },
    "Zuckuss": {
      text: "%SCUMONLY%%LINEBREAK%When attacking, if you are not stressed, you may receive any number of stress tokens to choose an equal number of defense dice.  The defender must reroll those dice."
    },
    'Rage': {
      text: "<strong>Action:</strong> Assign 1 focus token to your ship and receive 2 stress tokens.  Until the end of the round, when attacking, you may reroll up to 3 attack dice."
    },
    "Attanni Mindlink": {
      text: "%SCUMONLY%%LINEBREAK%Each time you are assigned a focus or stress token, each other friendly ship with Attanni Mindlink must also be assigned the same type of token if it does not already have one."
    },
    "Boba Fett": {
      text: "%SCUMONLY%%LINEBREAK%After performing an attack, if the defender was dealt a faceup Damage card, you may discard this card to choose and discard 1 of the defender's Upgrade cards."
    },
    "Dengar": {
      text: "%SCUMONLY%%LINEBREAK%When attacking, you may reroll 1 attack die.  If the defender is a unique pilot, you may instead reroll up to 2 attack dice."
    },
    '"Gonk"': {
      text: "%SCUMONLY%%LINEBREAK%<strong>Action:</strong> Place 1 shield token on this card.%LINEBREAK%<strong>Action:</strong> Remove 1 shield token from this card to recover 1 shield (up to your shield value)."
    },
    "R5-P8": {
      text: "Once per round, after defending, you may roll 1 attack die.  On a %HIT% result, the attacker suffers 1 damage.  On a %CRIT% result, you and the attacker each suffer 1 damage."
    },
    'Thermal Detonators': {
      text: "When you reveal your maneuver dial, you may discard this card to <strong>drop</strong> 1 thermal detonator token.%LINEBREAK%This token <strong>detonates</strong> at the end of the Activation phase.%LINEBREAK%<strong>Thermal Detonator Token:</strong> When this bomb token detonates, each ship at Range 1 of the token suffers 1 damage and receives 1 stress token.  Then discard this token."
    },
    "Overclocked R4": {
      text: "During the Combat phase, when you spend a focus token, you may receive 1 stress token to assign 1 focus token to your ship."
    },
    'Systems Officer': {
      text: '%IMPERIALONLY%%LINEBREAK%After you execute a green maneuver, choose another friendly ship at Range 1.  That ship may acquire a target lock.'
    },
    'Tail Gunner': {
      text: 'When attacking from your rear-facing auxiliary firing arc, reduce the defender\'s agility by 1 (to a minimum of "0").'
    },
    'R3 Astromech': {
      text: 'Once per round, when attacking with a primary weapon, you may cancel 1 of your %FOCUS% results during the "Modify Attack Dice" step to assign 1 evade token to your ship.'
    },
    'Collision Detector': {
      text: 'When performing a boost, barrel roll, or decloak, your ship and maneuver template can overlap obstacles.%LINEBREAK%When rolling for obstacle damage, ignore all %CRIT% results.'
    },
    'Sensor Cluster': {
      text: 'When defending, you may spend a focus token to change 1 of your blank results to an %EVADE% result.'
    },
    'Fearlessness': {
      text: '%SCUMONLY%%LINEBREAK%When attacking, if you are inside the defender\'s firing arc at Range 1 and the defender is inside your firing arc, you may add 1 %HIT% result to your roll.'
    },
    'Ketsu Onyo': {
      text: '%SCUMONLY%%LINEBREAK%At the start of the End phase, you may choose 1 ship in your firing arc at Range 1-2.  That ship does not remove its tractor beam tokens.'
    },
    'Latts Razzi': {
      text: '%SCUMONLY%%LINEBREAK%When defending, you may remove 1 stress token from the attacker to add 1 %EVADE% result to your roll.'
    },
    'IG-88D': {
      text: '%SCUMONLY%%LINEBREAK%You have the pilot ability of each other friendly ship with the <em>IG-2000</em> Upgrade card (in addition to your own pilot ability).'
    },
    'Rigged Cargo Chute': {
      text: '%LARGESHIPONLY%%LINEBREAK%<strong>Action:</strong> Discard this card to <strong>drop</strong> one cargo token.'
    },
    'Seismic Torpedo': {
      text: '<strong>Action:</strong> Discard this card to choose an obstacle at Range 1-2 and inside your primary firing arc.  Each ship at Range 1 of the obstacle rolls 1 attack die and suffers any damage (%HIT%) or critical damage (%CRIT%) rolled.  Then remove the obstacle.'
    },
    'Black Market Slicer Tools': {
      text: '<strong>Action:</strong> Choose a stressed enemy ship at Range 1-2 and roll 1 attack die. On a (%HIT%) or (%CRIT%) result, remove 1 stress token and deal it 1 facedown Damage card.'
    },
    'Kylo Ren': {
      text: '%IMPERIALONLY%%LINEBREAK%<strong>Action:</strong> Assign the "I\'ll Show You the Dark Side" Condition card to an enemy ship at Range 1-3.'
    },
    'Unkar Plutt': {
      text: '%SCUMONLY%%LINEBREAK%After executing a maneuver that causes you to overlap an enemy ship, you may suffer 1 damage to perform 1 free action.'
    },
    'A Score to Settle': {
      text: 'During setup, before the "Place Forces" step, choose 1 enemy ship and deal the "A Debt to Pay" Condition card to it.%LINEBREAK%When attacking a ship that has the "A Debt to Pay" Condition card, you may change 1 %FOCUS% result to a %CRIT% result.'
    },
    'Jyn Erso': {
      text: '%REBELONLY%%LINEBREAK%<strong>Action:</strong> Choose 1 friendly ship at Range 1-2. Assign 1 focus token to that ship for each enemy ship inside your firing arc at Range 1-3.  You cannot assign more than 3 focus tokens in this way.'
    },
    'Cassian Andor': {
      text: '%REBELONLY%%LINEBREAK%At the end of the Planning phase, you may choose an enemy ship at Range 1-2.  Guess aloud that ship\'s bearing and speed, then look at its dial.  If you are correct, you may rotate your dial to another maneuver.'
    },
    'Finn': {
      text: '%REBELONLY%%LINEBREAK%When attacking with a primary weapon or defending, if the enemy ship is inside your firing arc, you may add 1 blank result to your roll.'
    },
    'Rey': {
      text: '%REBELONLY%%LINEBREAK%At the start of the End phase, you may place 1 of your ship\'s focus tokens on this card.  At the start of the Combat phase, you may assign 1 of those tokens to your ship.'
    },
    'Burnout SLAM': {
      text: '%LARGESHIPONLY%%LINEBREAK%Your action bar gains the %SLAM% action icon.%LINEBREAK%After you perform a SLAM action, discard this card.'
    },
    'Primed Thrusters': {
      text: '%SMALLSHIPONLY%%LINEBREAK%Stress tokens do not prevent you from performing boost or barrel roll actions unless you have 3 or more stress tokens.'
    },
    'Pattern Analyzer': {
      text: 'When executing a maneuver, you may resolve the "Check Pilot Stress" step after the "Perform Action" step (instead of before that step).'
    },
    'Snap Shot': {
      text: 'After an enemy ship executes a maneuver, you may perform this attack against that ship.  <strong>Attack:</strong> Attack 1 ship.  You cannot modify your attack dice and cannot attack again this phase.'
    },
    'M9-G8': {
      text: '%REBELONLY%%LINEBREAK%When a ship you have locked is attacking, you may choose 1 attack die.  The attacker must reroll that die.%LINEBREAK%You can acquire target locks on other friendly ships.'
    },
    'EMP Device': {
      text: 'During the Combat phase, instead of performing any attacks, you may discard this card to assign 2 ion tokens to each ship at Range 1.'
    },
    'Captain Rex': {
      text: '%REBELONLY%%LINEBREAK%After you perform an attack that does not hit, you may assign 1 focus token to your ship.'
    },
    'General Hux': {
      text: '%IMPERIALONLY%%LINEBREAK%<strong>Action:</strong> Choose up to 3 friendly ships at Range 1-2.  Assign 1 focus token to each and assign the "Fanatical Devotion" Condition card to 1 of them.  Then receive 1 stress token.'
    },
    'Operations Specialist': {
      text: '%LIMITED%%LINEBREAK%After a friendly ship at Range 1-2 performs an attack that does not hit, you may assign 1 focus token to a friendly ship at Range 1-3 of the attacker.'
    },
    'Targeting Synchronizer': {
      text: 'When a friendly ship at Range 1-2 is attacking a ship you have locked, the friendly ship treats the "<strong>Attack (target lock):</strong> header as "<strong>Attack:</strong>."  If a game effect instructs that ship to spend a target lock, it may spend your target lock instead.'
    },
    'Hyperwave Comm Scanner': {
      text: 'At the start of the "Place Forces" step, you may choose to treat your pilot skill value as "0," "6," or "12" until the end of the step.%LINEBREAK%During setup, after another friendly ship is placed at Range 1-2, you may assign 1 focus or evade token to it.'
    },
    'Trick Shot': {
      text: 'When attacking, if the attack is obstructed, you may roll 1 additional attack die.'
    },
    'Hotshot Co-pilot': {
      text: 'When attacking with a primary weapon, the defender must spend 1 focus token if able.%LINEBREAK%When defending, the attacker must spend 1 focus token if able.'
    },
    'Scavenger Crane': {
      text: 'After a ship at Range 1-2 is destroyed, you may choose a discarded %TORPEDO%, %MISSILE%, %BOMB%, %CANNON%, %TURRET%, or Modification Upgrade card that was equipped to your ship and flip it faceup.  Then roll 1 attack die.  On a blank result, discard Scavenger Crane.'
    },
    'Bodhi Rook': {
      text: '%REBELONLY%%LINEBREAK%When you acquire a target lock, you can lock onto an enemy ship at Range 1-3 of any friendly ship.'
    },
    'Baze Malbus': {
      text: '%REBELONLY%%LINEBREAK%After you perform an attack that does not hit, you may immediately perform a primary weapon attack against a different ship.  You cannot perform another attack this round.'
    },
    'Inspiring Recruit': {
      text: 'Once per round, when a friendly ship at Range 1-2 removes a stress token, it may remove 1 additional stress token.'
    },
    'Swarm Leader': {
      text: 'When performing a primary weapon attack, choose up to 2 other friendly ships that have the defender inside their firing arcs at Range 1-3. Remove 1 evade token from each chosen ship to roll 1 additional attack die for each token removed.'
    },
    'Bistan': {
      text: '%REBELONLY%%LINEBREAK%When attacking Range 1-2, you may change 1 of your %HIT% results to a %CRIT% result.'
    },
    'Expertise': {
      text: 'When attacking, if you are not stressed, you may change all of your %FOCUS% results to %HIT% results.'
    },
    'BoShek': {
      text: 'When a ship you are touching activates, you may look at its chosen maneuver.  If you do, its owner <strong>must</strong> rotate the dial to an adjacent maneuver.  The ship can reveal and execute that maneuver even while stressed.'
    },
    'Heavy Laser Turret': {
      text: '<span class="card-restriction">C-ROC Cruiser only.</span>%LINEBREAK%<strong>Attack (energy):</strong> Spend 2 energy from this card to perform this attack against 1 ship (even a ship outside of your firing arc).'
    },
    'Cikatro Vizago': {
      text: '%SCUMONLY%%LINEBREAK%At the start of the End phase, you may discard this card to replace a faceup %ILLICIT% or %CARGO% Upgrade card you have equipped with another Upgrade card of the same type of equal or fewer squad points.'
    },
    'Azmorigan': {
      text: '%HUGESHIPONLY% %SCUMONLY%%LINEBREAK%At the start of the End phase, you may spend 1 energy to replace a faceup %CREW% or %TEAM% Upgrade card you have equipped with another Upgrade card of the same type of equal or fewer squad points.'
    },
    'Quick-release Cargo Locks': {
      text: '<span class="card-restriction">C-ROC Cruiser and GR-75 Medium Transport only.</span>%LINEBREAK%At the end of the Activation phase, you may discard this card to <strong>place</strong> 1 container token.'
    },
    'Supercharged Power Cells': {
      text: 'When attacking, you may discard this card to roll 2 additional attack dice.'
    },
    'ARC Caster': {
      text: '<span class="card-restriction">Rebel and Scum only.</span>%DUALCARD%%LINEBREAK%<strong>Side A:</strong>%LINEBREAK%<strong>Attack:</strong> Attack 1 ship.  If this attack hits, you must choose 1 other ship at Range 1 of the defender to suffer 1 damage.%LINEBREAK%Then flip this card.%LINEBREAK%<strong>Side B:</strong>%LINEBREAK%(Recharging) At the start of the Combat phase, you may receive a weapons disabled token to flip this card.'
    },
    'Wookiee Commandos': {
      text: 'When attacking, you may reroll your %FOCUS% results.'
    },
    'Synced Turret': {
      text: '<strong>Attack (Target Lock):</strong> Attack 1 ship (even a ship outside your firing arc).%LINEBREAK%If the defender is inside your primary firing arc, you may reroll a number of attack dice up to your primary weapon value.'
    },
    'Unguided Rockets': {
      text: '<strong>Attack (focus):</strong> Attack 1 Ship.%LINEBREAK%Your attack dice can be modified only by spending a focus token for its standard effect.'
    },
    'Intensity': {
      text: '%SMALLSHIPONLY% %DUALCARD%%LINEBREAK%<strong>Side A:</strong> After you perform a boost or barrel roll action, you may assign 1 focus or evade token to your ship. If you do, flip this card.%LINEBREAK%<strong>Side B:</strong> (Exhausted) At the end of the Combat phase, you may spend 1 focus or evade token to flip this card.'
    },
    'Jabba the Hutt': {
      text: '%SCUMONLY%%LINEBREAK%When you equip this card, place 1 illicit token on each %ILLICIT% Upgrade card in your squad.  When you are instructed to discard an Upgrade card, you may discard 1 illicit token on that card instead.'
    },
    'IG-RM Thug Droids': {
      text: 'When attacking, you may change 1 of your %HIT% results to a %CRIT% result.'
    },
    'Selflessness': {
      text: '%SMALLSHIPONLY% %REBELONLY%%LINEBREAK%When a friendly ship at Range 1 is hit by an attack, you may discard this card to suffer all uncanceled %HIT% results instead of the target ship.'
    },
    'Breach Specialist': {
      text: 'When you are dealt a faceup Damage card, you may spend 1 reinforce token to flip it facedown (without resolving its effect).  If you do, until the end of the round, when you are dealt a faceup Damage card, flip it facedown (without resolving its effect).'
    },
    'Bomblet Generator': {
      text: 'When you reveal your maneuver, you may drop 1 Bomblet token.%LINEBREAK%This token <strong>detonates</strong> at the end of the Activation phase.%LINEBREAK%<strong>Bomblet Token:</strong> When this token detonates, each ship at Range 1 rolls 2 attack dice and suffers all damage (%HIT%) and critical damage (%CRIT%) rolled. Then discard this token.'
    },
    'Cad Bane': {
      text: '%SCUMONLY%%LINEBREAK%Your upgrade bar gains the %BOMB% icon. Once per round, when an enemy ship rolls attack dice due to a friendly bomb detonating, you may choose any number of %FOCUS% and blank results.  It must reroll those results.'
    },
    'Minefield Mapper': {
      text: 'During Setup, after the "Place Forces" step, you may discard any number of your equipped %BOMB% Upgrade cards.  Place all corresponding bomb tokens in the play area beyond Range 3 of enemy ships.'
    },
    'R4-E1': {
      text: 'You can perform actions on your %TORPEDO% and %BOMB% Upgrade cards even if you are stressed. After you perform an action in this way, you may discard this card to remove 1 stress token from your ship.'
    },
    'Cruise Missiles': {
      text: '<strong>Attack (Target Lock):</strong> Discard this card to perform this attack.%LINEBREAK%You may roll additional attack dice equal to the speed of the manuever you performed this round, to a maximum of 4 additional dice.'
    },
    'Ion Dischargers': {
      text: 'After you receive an ion token, you may choose an enemy ship at Range 1.  If you do, remove that ion token. Then that ship may choose to receive 1 ion token. If it does, discard this card.'
    },
    'Harpoon Missiles': {
      text: '<strong>Attack (target lock):</strong> Discard this card to perform this attack.%LINEBREAK%If this attack hits, assign the "Harpooned!" Condition to the defender.'
    },
    'Ordnance Silos': {
      text: '<span class="card-restriction">B/SF-17 Bomber only.</span>%LINEBREAK%When you equip this card, place 3 ordnance tokens on each other equipped %BOMB% Upgrade card. When you are instructed to discard an Upgrade card, you may discard 1 ordnance token on that card instead.'
    },
    'Trajectory Simulator': {
      text: 'You may launch bombs using the (%STRAIGHT% 5) template instead of dropping them.  You cannot launch bombs with the "<strong>Action:</strong>" header in this way.'
    },
    "Luke Skywalker.": {
      text: 'When defending, you may change 1 of your %FOCUS% results to a %EVADE% result.'
    },
    "Biggs Darklighter": {
      text: 'Other friendly ships at Range 1 cannot be targeted by attacks if the attacker could target you instead.'
    },
    '"Night Beast"': {
      text: 'After executing a green maneuver, you may perform a free focus action.'
    },
    '"Dark Curse"': {
      text: 'When defending, ships attacking you cannot spend focus tokens or reroll attack dice.'
    },
    '"Mauler Mithel"': {
      text: 'When attacking at Range 1, roll 1 additional attack die.'
    },
    "Wedge Antilles": {
      text: 'When attacking, reduce the defender\'s agility value by 1 (to a minimum of "0").'
    },
    "Garven Dreis": {
      text: 'After spending a focus token, you may place that token on any other friendly ship at Range 1-2 (instead of discarding it).'
    },
    '"Dutch" Vander': {
      text: 'After acquiring a target lock, choose another friendly ship at Range 1-2.  The chosen ship may immediately acquire a target lock.'
    },
    "Horton Salm": {
      text: 'When attacking at Range 2-3, you may reroll any of your blank results.'
    },
    '"Winged Gundark"': {
      text: 'When attacking at Range 1, you may change 1 of your %HIT% results to a %CRIT% result.'
    },
    '"Backstabber"': {
      text: 'When attacking from outside the defender\'s firing arc, roll 1 additional attack die.'
    },
    '"Howlrunner"': {
      text: 'When another friendly ship at Range 1 is attacking with its primary weapon, it may reroll 1 attack die.'
    },
    "Maarek Stele": {
      text: 'When your attack deals a faceup Damage card to the defender, instead draw 3 Damage cards, choose 1 to deal, and discard the others.'
    },
    "Darth Vader.": {
      text: 'During your "Perform Action" step, you may perform 2 actions.'
    },
    "\"Fel's Wrath\"": {
      text: 'When the number of Damage cards assigned to you equals or exceeds your hull value, you are not destroyed until the end of the Combat phase.'
    },
    "Turr Phennir": {
      text: 'After you perform an attack, you may perform a free boost or barrel roll action.'
    },
    "Soontir Fel": {
      text: 'When you receive a stress token, you may assign 1 focus token to your ship.'
    },
    "Tycho Celchu": {
      text: 'You may perform actions even while you have stress tokens.'
    },
    "Arvel Crynyd": {
      text: 'You may declare an enemy ship inside your firing arc that you are touching as the target of your attack.'
    },
    "Chewbacca.": {
      text: 'When you are dealt a faceup Damage card, immediately flip it facedown (without resolving its ability).'
    },
    "Lando Calrissian.": {
      text: 'After you execute a green maneuver, choose 1 other friendly ship at Range 1.  That ship may perform 1 free action shown on its action bar.'
    },
    "Han Solo.": {
      text: 'When attacking, you may reroll all of your dice.  If you choose to do so, you must reroll as many of your dice as possible.'
    },
    "Kath Scarlet": {
      text: 'When attacking, the defender receives 1 stress token if he cancels at least 1 %CRIT% result.'
    },
    "Boba Fett.": {
      text: 'When you reveal a bank maneuver (%BANKLEFT% or %BANKRIGHT%), you may rotate your dial to the other bank maneuver of the same speed.'
    },
    "Krassis Trelix": {
      text: 'When attacking with a secondary weapon, you may reroll 1 attack die.'
    },
    "Ten Numb": {
      text: 'When attacking, 1 of your %CRIT% results cannot be canceled by defense dice.'
    },
    "Ibtisam": {
      text: 'When attacking or defending, if you have at least 1 stress token, you may reroll 1 of your dice.'
    },
    "Roark Garnet": {
      text: 'At the start of the Combat phase, choose 1 other friendly ship at Range 1-3.  Until the end of the phase, treat that ship\'s pilot skill value as "12."'
    },
    "Kyle Katarn.": {
      text: 'At the start of the Combat phase, you may assign 1 of your focus tokens to another friendly ship at Range 1-3.'
    },
    "Jan Ors.": {
      text: 'When another friendly ship at Range 1-3 is attacking, if you have no stress tokens, you may receive 1 stress token to allow that ship to roll 1 additional attack die.'
    },
    "Captain Jonus": {
      text: 'When another friendly ship at Range 1 attacks with a secondary weapon, it may reroll up to 2 attack dice.'
    },
    "Major Rhymer": {
      text: 'When attacking with a secondary weapon, you may increase or decrease the weapon range by 1 to a limit of Range 1-3.'
    },
    "Captain Kagi": {
      text: 'When an enemy ship acquires a target lock, it must lock onto your ship if able.'
    },
    "Colonel Jendon": {
      text: 'At the start of the Combat phase, you may assign 1 of your blue target lock tokens to a friendly ship at Range 1 if it does not have a blue target lock token.'
    },
    "Captain Yorr": {
      text: 'When another friendly ship at Range 1-2 would receive a stress token, if you have 2 or fewer stress tokens, you may receive that token instead.'
    },
    "Lieutenant Blount": {
      text: 'When attacking, the defender is hit by your attack, even if he does not suffer any damage.'
    },
    "Airen Cracken": {
      text: 'After you perform an attack, you may choose another friendly ship at Range 1.  That ship may perform 1 free action.'
    },
    "Colonel Vessery": {
      text: 'When attacking, immediately after you roll attack dice, you may acquire a target lock on the defender if it already has a red target lock token.'
    },
    "Rexler Brath": {
      text: 'After you perform an attack that deals at least 1 Damage card to the defender, you may spend a focus token to flip those cards faceup.'
    },
    "Etahn A'baht": {
      text: 'When an enemy ship inside your firing arc at Range 1-3 is defending, the attacker may change 1 of its %HIT% results to a %CRIT% result.'
    },
    "Corran Horn": {
      text: 'At the start of the End phase, you may perform one attack.  You cannot attack during the next round.'
    },
    '"Echo"': {
      text: 'When you decloak, you must use the (%BANKLEFT% 2) or (%BANKRIGHT% 2) template instead of the (%STRAIGHT% 2) template.'
    },
    '"Whisper"': {
      text: 'After you perform an attack that hits, you may assign 1 focus to your ship.'
    },
    "Lieutenant Lorrir": {
      text: 'When performing a barrel roll action, you may receive 1 stress token to use the (%BANKLEFT% 1) or (%BANKRIGHT% 1) template instead of the (%STRAIGHT% 1) template.'
    },
    "Tetran Cowall": {
      text: 'When you reveal a %UTURN% maneuver, you may treat the speed of that maneuver as "1," "3," or "5".'
    },
    "Kir Kanos": {
      text: 'When attacking at Range 2-3, you may spend 1 evade token to add 1 %HIT% result to your roll.'
    },
    "Carnor Jax": {
      text: 'Enemy ships at Range 1 cannot perform focus or evade actions and cannot spend focus or evade tokens.'
    },
    "Dash Rendar.": {
      text: 'You may ignore obstacles during the Activation phase and when performing actions.'
    },
    '"Leebo".': {
      text: 'When you are dealt a faceup Damage card, draw 1 additional Damage card, choose 1 to resolve, and discard the other.'
    },
    "Eaden Vrill": {
      text: 'When performing a primary weapon attack against a stressed ship, roll 1 additional attack die.'
    },
    "Rear Admiral Chiraneau": {
      text: 'When attacking at Range 1-2, you may change 1 of your %FOCUS% results to a %CRIT% result.'
    },
    "Commander Kenkirk": {
      text: 'If you have no shields and at least 1 Damage card assigned to you, increase your agility value by 1.'
    },
    "Captain Oicunn": {
      text: 'After executing a maneuver, each enemy ship you are touching suffers 1 damage.'
    },
    "Wes Janson": {
      text: 'After you perform an attack, you may remove 1 focus, evade, or blue target lock token from the defender.'
    },
    "Jek Porkins": {
      text: 'When you receive a stress token, you may remove it and roll 1 attack die.  On a %HIT% result, deal 1 facedown Damage card to this ship.'
    },
    '"Hobbie" Klivian': {
      text: 'When you acquire or spend a target lock, you may remove 1 stress token from your ship.'
    },
    "Tarn Mison": {
      text: 'When an enemy ship declares you as the target of an attack, you may acquire a target lock on that ship.'
    },
    "Jake Farrell": {
      text: 'After you perform a focus action or are assigned a focus token, you may perform a free boost or barrel roll action.'
    },
    "Gemmer Sojan": {
      text: 'While you are at Range 1 of at least 1 enemy ship, increase your agility value by 1.'
    },
    "Keyan Farlander": {
      text: 'When attacking, you may remove 1 stress token to change all of your %FOCUS% results to %HIT%results.'
    },
    "Nera Dantels": {
      text: 'You can perform %TORPEDO% secondary weapon attacks against enemy ships outside your firing arc.'
    },
    "Prince Xizor": {
      text: 'When defending, a friendly ship at Range 1 may suffer 1 uncanceled %HIT% or %CRIT% result instead of you.'
    },
    "Guri": {
      text: 'At the start of the Combat phase, if you are at Range 1 of an enemy ship, you may assign 1 focus token to your ship.'
    },
    "Serissu": {
      text: 'When another friendly ship at Range 1 is defending, it may reroll 1 defense die.'
    },
    "Laetin A'shera": {
      text: 'After you defend against an attack, if the attack did not hit, you may assign 1 evade token to your ship.'
    },
    "IG-88A": {
      text: 'After you perform an attack that destroys the defender, you may recover 1 shield.'
    },
    "IG-88B": {
      text: 'Once per round, after you perform an attack that does not hit, you may perform an attack with an equipped %CANNON% secondary weapon.'
    },
    "IG-88C": {
      text: 'After you perform a boost action, you may perform a free evade action.'
    },
    "IG-88D.": {
      text: 'You may execute the (%SLOOPLEFT% 3) or (%SLOOPRIGHT% 3) maneuver using the corresponding (%TURNLEFT% 3) or (%TURNRIGHT% 3) template.'
    },
    "Boba Fett (Scum).": {
      text: 'When attacking or defending, you may reroll 1 of your dice for each enemy ship at Range 1.'
    },
    "Kath Scarlet (Scum)": {
      text: 'When attacking a ship inside your auxiliary firing arc, roll 1 additional attack die.'
    },
    "Emon Azzameen": {
      text: 'When dropping a bomb, you may use the (%TURNLEFT% 3), (%STRAIGHT% 3), or (%TURNRIGHT% 3) template instead of the (%STRAIGHT% 1) template.'
    },
    "Kavil": {
      text: 'When attacking a ship outside your firing arc, roll 1 additional attack die.'
    },
    "Drea Renthal": {
      text: 'After you spend a target lock, you may receive 1 stress token to acquire a target lock.'
    },
    "Dace Bonearm": {
      text: 'When an enemy ship at Range 1-3 receives at least 1 ion token, if you are not stressed, you may receive 1 stress token to cause that ship to suffer 1 damage.'
    },
    "Palob Godalhi": {
      text: 'At the start of the Combat phase, you may remove 1 focus or evade token from an enemy ship at Range 1-2 and assign it to yourself.'
    },
    "Torkil Mux": {
      text: 'At the end of the Activation phase, choose 1 enemy ship at Range 1-2. Until the end of the Combat phase, treat that ship\'s pilot skill value as "0".'
    },
    "N'Dru Suhlak": {
      text: 'When attacking, if there are no other friendly ships at Range 1-2, roll 1 additional attack die.'
    },
    "Kaa'to Leeachos": {
      text: 'At the start of the Combat phase, you may remove 1 focus or evade token from another friendly ship at Range 1-2 and assign it to yourself.'
    },
    "Commander Alozen": {
      text: 'At the start of the Combat phase, you may acquire a target lock on an enemy ship at Range 1.'
    },
    "Bossk.": {
      text: 'When you perform an attack that hits, before dealing damage, you may cancel 1 of your %CRIT% results to add 2 %HIT% results.'
    },
    "Talonbane Cobra": {
      text: 'When attacking or defending, double the effect of your range combat bonuses.'
    },
    "Miranda Doni": {
      text: 'Once per round when attacking, you may either spend 1 shield to roll 1 additional attack die <strong>or</strong> roll 1 fewer attack die to recover 1 shield.'
    },
    '"Redline"': {
      text: 'You may maintain 2 target locks on the same ship.  When you acquire a target lock, you may acquire a second lock on that ship.'
    },
    '"Deathrain"': {
      text: 'When dropping a bomb, you may use the front guides of your ship.  After dropping a bomb, you may perform a free barrel roll action.'
    },
    "Juno Eclipse": {
      text: 'When you reveal your maneuver, you may increase or decrease its speed by 1 (to a minimum of 1).'
    },
    "Zertik Strom": {
      text: 'Enemy ships at Range 1 cannot add their range combat bonus when attacking.'
    },
    "Lieutenant Colzet": {
      text: 'At the start of the End phase, you may spend a target lock you have on an enemy ship to flip 1 random facedown Damage card assigned to it faceup.'
    },
    "Latts Razzi.": {
      text: 'When a friendly ship declares an attack, you may spend a target lock you have on the defender to reduce its agility by 1 for that attack.'
    },
    "Graz the Hunter": {
      text: 'When defending, if the attacker is inside your firing arc, roll 1 additional defense die.'
    },
    "Esege Tuketu": {
      text: 'When another friendly ship at Range 1-2 is attacking, it may treat your focus tokens as its own.'
    },
    "Moralo Eval": {
      text: 'You can perform %CANNON% secondary attacks against ships inside your auxiliary firing arc.'
    },
    '"Scourge"': {
      text: 'When attacking a defender that has 1 or more Damage cards, roll 1 additional attack die.'
    },
    '"Youngster"': {
      text: 'You may equip Action: EPTs. Friendly TIE fighters at range 1-3 may perform the action on your equipped EPT upgrade card.'
    },
    '"Wampa"': {
      text: 'When attacking, you may cancel all die results.  If you cancel a %CRIT% result, deal 1 facedown Damage card to the defender.'
    },
    '"Chaser"': {
      text: 'When another friendly ship at Range 1 spends a focus token, assign a focus token to your ship.'
    },
    "The Inquisitor": {
      text: 'When attacking with your primary weapon at Range 2-3, treat the range of the attack as Range 1.'
    },
    "Zuckuss.": {
      text: 'When attacking, you may roll 1 additional attack die.  If you do, the defender rolls 1 additional defense die.'
    },
    "Dengar.": {
      text: 'Once per round after defending, if the attacker is inside your firing arc, you may perform an attack against that ship.'
    },
    "Poe Dameron": {
      text: 'When attacking or defending, if you have a focus token, you may change 1 of your %FOCUS% results to a %HIT% or %EVADE% result.'
    },
    '"Blue Ace"': {
      text: 'When performing a boost action, you may use the (%TURNLEFT% 1) or (%TURNRIGHT% 1) template.'
    },
    '"Omega Ace"': {
      text: 'When attacking, you may spend a focus token and a target lock you have on the defender to change all of your results to %CRIT% results.'
    },
    '"Epsilon Leader"': {
      text: 'At the start of the Combat phase, remove 1 stress token from each friendly ship at Range 1.'
    },
    '"Zeta Ace"': {
      text: 'When performing a barrel roll you may use the (%STRAIGHT% 2) template instead of the (%STRAIGHT% 1) template.'
    },
    '"Red Ace"': {
      text: 'The first time you remove a shield token from your ship each round, assign 1 evade token to your ship.'
    },
    '"Omega Leader"': {
      text: 'Enemy ships that you have locked cannot modify any dice when attacking you or defending against your attacks.'
    },
    'Hera Syndulla.': {
      text: 'When you reveal a green or red maneuver, you may rotate your dial to another maneuver of the same difficulty.'
    },
    'Ezra Bridger.': {
      text: 'When defending, if you are stressed, you may change up to 2 of your %FOCUS% results to %EVADE% results.'
    },
    '"Zeta Leader"': {
      text: 'When attacking, if you are not stressed, you may receive 1 stress token to roll 1 additional die.'
    },
    '"Epsilon Ace"': {
      text: 'While you do not have any Damage cards, treat your pilot skill value as "12."'
    },
    "Kanan Jarrus.": {
      text: 'When an enemy ship at Range 1-2 is attacking, you may spend a focus token.  If you do, the attacker rolls 1 fewer attack die.'
    },
    '"Chopper".': {
      text: 'At the start of the Combat phase, each enemy ship you are touching receives 1 stress token.'
    },
    'Sabine Wren.': {
      text: 'Immediately before you reveal your maneuver, you may perform a free boost or barrel roll action.'
    },
    '"Zeb" Orrelios.': {
      text: 'When defending, you may cancel %CRIT% results before %HIT% results.'
    },
    'Tomax Bren': {
      text: 'You may equip discardable EPTs. Once per round after you discard an EPT upgrade card, flip that card faceup.'
    },
    'Ello Asty': {
      text: 'While you are not stressed, you may treat your %TROLLLEFT% and %TROLLRIGHT% maneuvers as white maneuvers.'
    },
    "Valen Rudor": {
      text: 'After defending, you may perform a free action.'
    },
    "4-LOM.": {
      text: 'At the start of the End phase, you may assign 1 of your stress tokens to another ship at Range 1.'
    },
    "Tel Trevura": {
      text: 'The first time you would be destroyed, instead cancel any remaining damage, discard all Damage cards, and deal 4 facedown Damage cards to this ship.'
    },
    "Manaroo": {
      text: 'At the start of the Combat phase, you may assign all focus, evade, and target lock tokens assigned to you to another friendly ship at Range 1.'
    },
    '"Deathfire"': {
      text: 'When you reveal your maneuver dial or after you perform an action, you may perform a %BOMB% Upgrade card action as a free action.'
    },
    "Maarek Stele (TIE Defender)": {
      text: 'When your attack deals a faceup Damage card to the defender, instead draw 3 Damage cards, choose 1 to deal, and discard the others.'
    },
    "Countess Ryad": {
      text: 'When you reveal a %STRAIGHT% maneuver, you may treat it as a %KTURN% maneuver.'
    },
    'Norra Wexley': {
      text: 'When attacking or defending, you may spend a target lock you have on the enemy ship to add 1 %FOCUS% result to your roll.'
    },
    'Shara Bey': {
      text: 'When another friendly ship at Range 1-2 is attacking, it may treat your blue target lock tokens as its own.'
    },
    'Thane Kyrell': {
      text: 'After an enemy ship in your firing arc at Range 1-3 attacks another friendly ship, you may perform a free action.'
    },
    'Braylen Stramm': {
      text: 'After you execute a maneuver, you may roll an attack die.  On a %HIT% or %CRIT% result, remove 1 stress token from your ship.'
    },
    '"Quickdraw"': {
      text: 'Once per round, when you lose a shield token, you may perform a primary weapon attack.'
    },
    '"Backdraft"': {
      text: 'When attacking a ship inside your auxiliary firing arc, you may add 1 %CRIT% result.'
    },
    'Fenn Rau': {
      text: 'When attacking or defending, if the enemy ship is at Range 1, you may roll 1 additional die.'
    },
    'Old Teroch': {
      text: 'At the start of the Combat phase, you may choose 1 enemy ship at Range 1.  If you are inside its firing arc, it discards all focus and evade tokens.'
    },
    'Kad Solus': {
      text: 'After you execute a red maneuver, assign 2 focus tokens to your ship.'
    },
    'Ketsu Onyo.': {
      text: 'At the start of the Combat phase, you may choose a ship at Range 1.  If it is inside your primary <strong>and</strong> mobile firing arcs, assign 1 tractor beam token to it.'
    },
    'Asajj Ventress': {
      text: 'At the start of the Combat phase, you may choose a ship at Range 1-2.  If it is inside your mobile firing arc, assign 1 stress token to it.'
    },
    'Sabine Wren (Scum)': {
      text: 'When defending against an enemy ship inside your mobile firing arc at Range 1-2, you may add 1 %FOCUS% result to your roll.'
    },
    "Poe Dameron (PS9)": {
      text: 'When attacking or defending, if you have a focus token, you may change 1 of your %FOCUS% results to a %HIT% or %EVADE% result.'
    },
    "Rey.": {
      text: 'When attacking or defending, if the enemy ship is inside of your firing arc, you may reroll up to 2 of your blank results.'
    },
    'Han Solo (TFA)': {
      text: 'When you are placed during setup, you can be placed anywhere in the play area beyond Range 3 of enemy ships.'
    },
    'Chewbacca (TFA)': {
      text: 'After another friendly ship at Range 1-3 is destroyed (but has not fled the battlefield), you may perform an attack.'
    },
    'Kylo Ren.': {
      text: 'The first time you are hit by an attack each round, deal the "I\'ll Show You the Dark Side" Condition card to the attacker.'
    },
    'Unkar Plutt.': {
      text: 'At the end of the Activation phase, you <strong>must</strong> assign a tractor beam token to each ship you are touching.'
    },
    'Cassian Andor.': {
      text: 'At the start of the Activation phase, you may remove 1 stress token from 1 other friendly ship at Range 1-2.'
    },
    'Bodhi Rook.': {
      text: 'When a friendly ship acquires a target lock, that ship can lock onto an enemy ship at Range 1-3 of any friendly ship.'
    },
    'Heff Tobber': {
      text: 'After an enemy ship executes a maneuver that causes it to overlap your ship, you may perform a free action.'
    },
    '"Duchess"': {
      text: 'While you have the "Adaptive Ailerons" Upgrade card equipped, you may choose to ignore its card ability.'
    },
    '"Pure Sabacc"': {
      text: 'When attacking, if you have 1 or fewer Damage cards, roll 1 additional attack die.'
    },
    '"Countdown"': {
      text: 'When defending, if you are not stressed, during the "Compare Results" step, you may suffer 1 damage to cancel all dice results.  If you do, receive 1 stress token.'
    },
    'Nien Nunb.': {
      text: 'When you receive a stress token, if there is an enemy ship inside your firing arc at Range 1, you may discard that stress token.'
    },
    '"Snap" Wexley': {
      text: 'After you execute a 2-, 3-, or 4-speed maneuver, if you are not touching a ship, you may perform a free boost action.'
    },
    'Jess Pava': {
      text: 'When attacking or defending, you may reroll 1 of your dice for each other friendly ship at Range 1.'
    },
    'Ahsoka Tano': {
      text: 'At the start of the Combat phase, you may spend 1 focus token to choose a friendly ship at Range 1.  It may perform 1 free action.'
    },
    'Captain Rex.': {
      text: 'After you perform an attack, assign the "Suppressive Fire" Condition card to the defender.'
    },
    'Major Stridan': {
      text: 'For the purpose of your actions and Upgrade cards, you may treat friendly ships at Range 2-3 as being at Range 1.'
    },
    'Lieutenant Dormitz': {
      text: 'During setup, friendly ships may placed anywhere in the play area at Range 1-2 of you.'
    },
    'Constable Zuvio': {
      text: 'When you reveal a reverse maneuver, you may drop a bomb using your front guides (including a bomb with the "<strong>Action:</strong>" header).'
    },
    'Sarco Plank': {
      text: 'When defending, instead of using your agility value, you may roll a number of defense dice equal to the speed of the maneuver you executed this round.'
    },
    'Genesis Red': {
      text: 'After you acquire a target lock, assign focus and evade tokens to your ship until you have the same number of each token as the locked ship.'
    },
    'Quinn Jast': {
      text: 'At the start of the Combat phase, you may receive a weapons disabled token to flip one of your discarded %TORPEDO% or %MISSILE% Upgrade cards faceup.'
    },
    'Inaldra': {
      text: 'When attacking or defending, you may spend 1 shield to reroll any number of your dice.'
    },
    'Sunny Bounder': {
      text: 'Once per round, after you roll or reroll dice, if you have the same result on each of your dice, add 1 matching result.'
    },
    'Lieutenant Kestal': {
      text: 'When attacking, you may spend 1 focus token to cancel all of the defender\'s blank and %FOCUS% results.'
    },
    '"Double Edge"': {
      text: 'Once per round, after you perform a secondary weapon attack that does not hit, you may perform an attack with a different weapon.'
    },
    'Viktor Hel': {
      text: 'After defending, if you did not roll exactly 2 defense dice, the attacker receives 1 stress token.'
    },
    'Lowhhrick': {
      text: 'When another friendly ship at Range 1 is defending, you may spend 1 reinforce token. If you do, the defender adds 1 %EVADE% result.'
    },
    'Wullffwarro': {
      text: 'When attacking, if you have no shields and at least 1 Damage card assigned to you, roll 1 additional attack die.'
    },
    'Captain Nym (Scum)': {
      text: 'You may ignore friendly bombs. When a friendly ship is defending, if the attacker measures range through a friendly bomb token, the defender may add 1 %EVADE% result.'
    },
    'Captain Nym (Rebel)': {
      text: 'Once per round, you may prevent a friendly bomb from detonating.'
    },
    'Sol Sixxa': {
      text: 'When dropping a bomb, you may use the (%TURNLEFT% 1) or (%TURNRIGHT% 1) template instead of the (%STRAIGHT% 1) template.'
    },
    'Dalan Oberos': {
      text: 'If you are not stressed, when you reveal a turn, bank, or Segnor\'s Loop maneuver, you may instead treat it as a red Tallon Roll maneuver of the same direction (left or right) using the template of the original revealed maneuver.'
    },
    'Thweek': {
      text: 'During setup, before the "Place Forces" step, you may choose 1 enemy ship and assign the "Shadowed" or "Mimicked" Condition card to it.'
    },
    'Captain Jostero': {
      text: 'Once per round, after an enemy ship that is not defending against an attack suffers damage or critical damage, you may perform an attack against that ship.'
    }
  };
  modification_translations = {
    "Stealth Device": {
      text: "Increase your agility value by 1.  If you are hit by an attack, discard this card."
    },
    "Shield Upgrade": {
      text: "Increase your shield value by 1."
    },
    "Engine Upgrade": {
      text: "Your action bar gains the %BOOST% action icon."
    },
    "Anti-Pursuit Lasers": {
      text: "%LARGESHIPONLY%%LINEBREAK%After an enemy ship executes a maneuver that causes it to overlap your ship, roll 1 attack die.  On a %HIT% or %CRIT% result, the enemy ship suffers 1 damage."
    },
    "Targeting Computer": {
      text: "Your action bar gains the %TARGETLOCK% action icon."
    },
    "Hull Upgrade": {
      text: "Increase your hull value by 1."
    },
    "Munitions Failsafe": {
      text: "When attacking with a secondary weapon that instructs you to discard it to perform the attack, do not discard it unless the attack hits."
    },
    "Stygium Particle Accelerator": {
      text: "When you either decloak or perform a cloak action, you may perform a free evade action."
    },
    "Advanced Cloaking Device": {
      text: "<span class=\"card-restriction\">TIE Phantom only.</span>%LINEBREAK%After you perform an attack, you may perform a free cloak action."
    },
    "Combat Retrofit": {
      text: "<span class=\"card-restriction\">GR-75 only.</span>%LINEBREAK%Increase your hull value by 2 and your shield value by 1."
    },
    "B-Wing/E2": {
      text: "<span class=\"card-restriction\">B-Wing only.</span>%LINEBREAK%Your upgrade bar gains the %CREW% upgrade icon."
    },
    "Countermeasures": {
      text: "%LARGESHIPONLY%%LINEBREAK%At the start of the Combat phase, you may discard this card to increase your agility value by 1 until the end of the round.  Then you may remove 1 enemy target lock from your ship."
    },
    "Experimental Interface": {
      text: "Once per round, after you perform an action, you may perform 1 free action from an equipped Upgrade card with the \"<strong>Action:</strong>\" header.  Then receive 1 stress token."
    },
    "Tactical Jammer": {
      text: "%LARGESHIPONLY%%LINEBREAK%Your ship can obstruct enemy attacks."
    },
    "Autothrusters": {
      text: "When defending, if you are beyond Range 2 or outside the attacker's firing arc, you may change 1 of your blank results to a %EVADE% result. You can equip this card only if you have the %BOOST% action icon."
    },
    "Advanced SLAM": {
      text: "After performing a SLAM action, if you did not overlap an obstacle or another ship, you may perform a free action."
    },
    "Twin Ion Engine Mk. II": {
      text: "<span class=\"card-restriction\">TIE only.</span>%LINEBREAK%You may treat all bank maneuvers (%BANKLEFT% and %BANKRIGHT%) as green maneuvers."
    },
    "Maneuvering Fins": {
      text: "<span class=\"card-restriction\">YV-666 only.</span>%LINEBREAK%When you reveal a turn maneuver (%TURNLEFT% or %TURNRIGHT%), you may rotate your dial to the corresponding bank maneuver (%BANKLEFT% or %BANKRIGHT%) of the same speed."
    },
    "Ion Projector": {
      text: "%LARGESHIPONLY%%LINEBREAK%After an enemy ship executes a maneuver that causes it to overlap your ship, roll 1 attack die.  On a %HIT% or %CRIT% result, the enemy ship receives 1 ion token."
    },
    'Integrated Astromech': {
      text: '<span class="card-restriction">X-wing only.</span>%LINEBREAK%When you are dealt a Damage card, you may discard 1 of your %ASTROMECH% Upgrade cards to discard that Damage card.'
    },
    'Optimized Generators': {
      text: '%HUGESHIPONLY%%LINEBREAK%Once per round, when you assign energy to an equipped Upgrade card, gain 2 energy.'
    },
    'Automated Protocols': {
      text: '%HUGESHIPONLY%%LINEBREAK%Once per round, after you perform an action that is not a recover or reinforce action, you may spend 1 energy to perform a free recover or reinforce action.'
    },
    'Ordnance Tubes': {
      text: '%HUGESHIPONLY%%LINEBREAK%You may treat each of your %HARDPOINT% upgrade icons as a %TORPEDO% or %MISSILE% icon.%LINEBREAK%When you are instructed to discard a %TORPEDO% or %MISSILE% Upgrade card, do not discard it.'
    },
    'Long-Range Scanners': {
      text: 'You can acquire target locks on ships at Range 3 and beyond.  You cannot acquire target locks on ships at Range 1-2.  You can equip this card only if you have %TORPEDO% and %MISSILE% in your upgrade bar.'
    },
    "Guidance Chips": {
      text: "Once per round, when attacking with a %TORPEDO% or %MISSILE% secondary weapon, you may change 1 die result to a %HIT% result (or a %CRIT% result if your primary weapon value is \"3\" or higher)."
    },
    'Vectored Thrusters': {
      text: '%SMALLSHIPONLY%%LINEBREAK%Your action bar gains the %BARRELROLL% action icon.'
    },
    'Smuggling Compartment': {
      text: '<span class="card-restriction">YT-1300 and YT-2400 only.</span>%LINEBREAK%Your upgrade bar gains the %ILLICIT% upgrade icon.%LINEBREAK%You may equip 1 additional Modification upgrade that costs 3 or fewer squad points.'
    },
    'Gyroscopic Targeting': {
      text: '<span class="card-restriction">Lancer-class Pursuit Craft only.</span>%LINEBREAK%At the end of the Combat phase, if you executed a 3-, 4-, or 5-speed maneuver this round, you may rotate your mobile firing arc.'
    },
    'Captured TIE': {
      text: '<span class="card-restriction">TIE Fighter only.</span> %REBELONLY%%LINEBREAK%Enemy ships with a pilot skill value lower than yours cannot declare you as the target of an attack.  After you perform an attack or when you are the only remaining friendly ship, discard this card.'
    },
    'Spacetug Tractor Array': {
      text: '<span class="card-restriction">Quadjumper only.</span>%LINEBREAK%<strong>Action:</strong> Choose a ship inside your firing arc at Range 1 and assign a tractor beam token to it.  If it is a friendly ship, resolve the effect of the tractor beam token as though it were an enemy ship.'
    },
    'Lightweight Frame': {
      text: '<span class="card-restriction">TIE only.</span>%LINEBREAK%When defending, after rolling defense dice, if there are more attack dice than defense dice, roll 1 additional defense die.%LINEBREAK%You cannot equip this card if your agility value is "3" or higher.'
    },
    'Pulsed Ray Shield': {
      text: '<span class="card-restriction">Rebel and Scum only.</span>%LINEBREAK%During the End phase, you may receive 1 ion token to recover 1 shield (up to your shield value). You can equip this card only if your shield value is "1."'
    }
  };
  title_translations = {
    "Slave I": {
      text: "<span class=\"card-restriction\">Firespray-31 only.</span>%LINEBREAK%Your upgrade bar gains the %TORPEDO% upgrade icon."
    },
    "Millennium Falcon": {
      text: "<span class=\"card-restriction\">YT-1300 only.</span>%LINEBREAK%Your action bar gains the %EVADE% action icon."
    },
    "Moldy Crow": {
      text: "<span class=\"card-restriction\">HWK-290 only.</span>%LINEBREAK%During the End phase, do not remove unused focus tokens from your ship."
    },
    "ST-321": {
      text: "<span class=\"card-restriction\"><em>Lambda</em>-class Shuttle only.</span>%LINEBREAK%When acquiring a target lock, you may lock onto any enemy ship in the play area."
    },
    "Royal Guard TIE": {
      text: "<span class=\"card-restriction\">TIE Interceptor only.</span>%LINEBREAK%You may equip up to 2 different Modification upgrades (instead of 1).%LINEBREAK%You cannot equip this card if your pilot skill value is \"4\" or lower."
    },
    "Dodonna's Pride": {
      text: "<span class=\"card-restriction\">CR90 fore section only.</span>%LINEBREAK%When you perform a coordinate action, you may choose 2 friendly ships (instead of 1).  Those ships may each perform 1 free action."
    },
    "A-Wing Test Pilot": {
      text: "<span class=\"card-restriction\">A-Wing only.</span>%LINEBREAK%Your upgrade bar gains 1 %ELITE% upgrade icon.%LINEBREAK%You cannot equip 2 of the same %ELITE% Upgrade cards.  You cannot equip this if your pilot skill value is \"1\" or lower."
    },
    "Tantive IV": {
      text: "<span class=\"card-restriction\">CR90 fore section only.</span>%LINEBREAK%Your fore section upgrade bar gains 1 additional %CREW% and 1 additional %TEAM% upgrade icon."
    },
    "Bright Hope": {
      text: "<span class=\"card-restriction\">GR-75 only.</span>%LINEBREAK%A reinforce action assigned to your fore section adds 2 %EVADE% results (instead of 1)."
    },
    "Quantum Storm": {
      text: "<span class=\"card-restriction\">GR-75 only.</span>%LINEBREAK%At the start of the End phase, if you have 1 or fewer energy tokens, gain 1 energy token."
    },
    "Dutyfree": {
      text: "<span class=\"card-restriction\">GR-75 only.</span>%LINEBREAK%When performing a jam action, you may choose an enemy ship at Range 1-3 (instead of at Range 1-2)."
    },
    "Jaina's Light": {
      text: "<span class=\"card-restriction\">CR90 fore section only.</span>%LINEBREAK%When defending, once per attack, if you are dealt a faceup Damage card, you may discard it and draw another faceup Damage card."
    },
    "Outrider": {
      text: "<span class=\"card-restriction\">YT-2400 only.</span>%LINEBREAK%While you have a %CANNON% Upgrade card equipped, you <strong>cannot</strong> perform primary weapon attacks and you may perform %CANNON% secondary weapon attacks against ships outside your firing arc."
    },
    "Dauntless": {
      text: "<span class=\"card-restriction\">VT-49 Decimator only.</span>%LINEBREAK%After you execute a maneuver that causes you to overlap another ship, you may perform 1 free action.  Then receive 1 stress token."
    },
    "Virago": {
      text: "<span class=\"card-restriction\">StarViper only.</span>%LINEBREAK%Your upgrade bar gains the %SYSTEM% and %ILLICIT% upgrade icons.%LINEBREAK%You cannot equip this card if your pilot skill value is \"3\" or lower."
    },
    '"Heavy Scyk" Interceptor (Cannon)': {
      text: "<span class=\"card-restriction\">M3-A Interceptor only.</span>%LINEBREAK%Your upgrade bar gains the %CANNON%, %TORPEDO%, or %MISSILE% upgrade icon.%LINEBREAK%Increase your hull value by 1."
    },
    '"Heavy Scyk" Interceptor (Torpedo)': {
      text: "<span class=\"card-restriction\">M3-A Interceptor only.</span>%LINEBREAK%Your upgrade bar gains the %CANNON%, %TORPEDO%, or %MISSILE% upgrade icon.%LINEBREAK%Increase your hull value by 1."
    },
    '"Heavy Scyk" Interceptor (Missile)': {
      text: "<span class=\"card-restriction\">M3-A Interceptor only.</span>%LINEBREAK%Your upgrade bar gains the %CANNON%, %TORPEDO%, or %MISSILE% upgrade icon.%LINEBREAK%Increase your hull value by 1."
    },
    "IG-2000": {
      text: "<span class=\"card-restriction\">Aggressor only.</span> %SCUMONLY%%LINEBREAK%You have the pilot ability of each other friendly ship with the <em>IG-2000</em> Upgrade card (in addition to your own pilot ability)."
    },
    "BTL-A4 Y-Wing": {
      text: "<span class=\"card-restriction\">Y-Wing only.</span>%LINEBREAK%You cannot attack ships outside your firing arc. After you perform a primary weapon attack, you may immediately perform an attack with a %TURRET% secondary weapon."
    },
    "Andrasta": {
      text: "Your upgrade bar gains two additional %BOMB% upgrade icons."
    },
    "TIE/x1": {
      text: "<span class=\"card-restriction\">TIE Advanced only.</span>%LINEBREAK%Your upgrade bar gains the %SYSTEM% upgrade icon.%LINEBREAK%If you equip a %SYSTEM% upgrade, its squad point cost is reduced by 4 (to a minimum of 0)."
    },
    "Hound's Tooth": {
      text: "<span class=\"card-restriction\">YV-666 only.</span>%LINEBREAK%After you are destroyed, before you are removed from the play area, you may <strong>deploy</strong> the <em>Nashtah Pup</em> ship.%LINEBREAK%It cannot attack this round."
    },
    "Ghost": {
      text: "<span class=\"card-restriction\">VCX-100 only.</span>%LINEBREAK%Equip the <em>Phantom</em> title card to a friendly Attack Shuttle and dock it to this ship.%LINEBREAK%After you execute a maneuver, you may deploy it from your rear guides."
    },
    "Phantom": {
      text: "While you are docked, the <em>Ghost</em> can perform primary weapon attacks from its special firing arc, and, at the end of the Combat phase, it may perform an additional attack with an equipped %TURRET%. If it performs this attack, it cannot attack again this round."
    },
    "TIE/v1": {
      text: "<span class=\"card-restriction\">TIE Advanced Prototype only.</span>%LINEBREAK%After you acquire a target lock, you may perform a free evade action."
    },
    "Mist Hunter": {
      text: "<span class=\"card-restriction\">G-1A starfighter only.</span>%LINEBREAK%Your action bar gains the %BARRELROLL% action icon.%LINEBREAK%You <strong>must</strong> equip 1 \"Tractor Beam\" Upgrade card (paying its squad point cost as normal)."
    },
    "Punishing One": {
      text: "<span class=\"card-restriction\">JumpMaster 5000 only.</span>%LINEBREAK%Increase your primary weapon value by 1."
    },
    "Assailer": {
      text: "<span class=\"card-restriction\"><em>Raider</em>-class corvette aft section only.</span>%LINEBREAK%When defending, if the targeted section has a reinforce token, you may change 1 %FOCUS% result to a %EVADE% result."
    },
    "Instigator": {
      text: "<span class=\"card-restriction\"><em>Raider</em>-class corvette aft section only.</span>%LINEBREAK%After you perform a recover action, recover 1 additional shield."
    },
    "Impetuous": {
      text: "<span class=\"card-restriction\"><em>Raider</em>-class corvette aft section only.</span>%LINEBREAK%After you perform an attack that destroys an enemy ship, you may acquire a target lock."
    },
    'TIE/x7': {
      text: '<span class="card-restriction">TIE Defender only.</span>%LINEBREAK%Your upgrade bar loses the %CANNON% and %MISSILE% upgrade icons.%LINEBREAK%After executing a 3-, 4-, or 5-speed maneuver, if you did not overlap an obstacle or ship, you may perform a free evade action.'
    },
    'TIE/D': {
      text: '<span class="card-restriction">TIE Defender only.</span>%LINEBREAK%Once per round, after you perform an attack with a %CANNON% secondary weapon that costs 3 or fewer squad points, you may perform a primary weapon attack.'
    },
    'TIE Shuttle': {
      text: '<span class="card-restriction">TIE Bomber only.</span>%LINEBREAK%Your upgrade bar loses all %TORPEDO%, %MISSILE%, and %BOMB% upgrade icons and gains 2 %CREW% upgrade icons.  You cannot equip a %CREW% Upgrade card that costs more than 4 squad points.'
    },
    'Requiem': {
      text: '%GOZANTIONLY%%LINEBREAK%When you deploy a ship, treat its pilot skill value as "8" until the end of the round.'
    },
    'Vector': {
      text: '%GOZANTIONLY%%LINEBREAK%After you execute a maneuver, you may deploy up to 4 attached ships (instead of 2).'
    },
    'Suppressor': {
      text: '%GOZANTIONLY%%LINEBREAK%Once per round, after you acquire a target lock, you may remove 1 focus, evade, or blue target lock token from that ship.'
    },
    'Black One': {
      text: 'After you perform a boost or barrel roll action, you may remove 1 enemy target lock from a friendly ship at Range 1.  You cannot equip this card if your pilot skill is "6" or lower.'
    },
    'Millennium Falcon (TFA)': {
      text: 'After you execute a 3-speed bank maneuver (%BANKLEFT% or %BANKRIGHT%), if you are not touching another ship and you are not stressed, you may receive 1 stress token to rotate your ship 180&deg;.'
    },
    'Alliance Overhaul': {
      text: '<span class="card-restriction">ARC-170 only.</span>%LINEBREAK%When attacking with a primary weapon from your primary firing arc, you may roll 1 additional attack die.  When attacking from your auxiliary firing arc, you may change 1 of your %FOCUS% results to a %CRIT% result.'
    },
    'Special Ops Training': {
      text: '<span class="card-restriction">TIE/sf only.</span>%LINEBREAK%When attacking with a primary weapon from your primary firing arc, you may roll 1 additional attack die.  If you do not, you may perform an additional attack from your auxiliary firing arc.'
    },
    'Concord Dawn Protector': {
      text: '<span class="card-restriction">Protectorate Starfighter only.</span>%LINEBREAK%When defending, if you are inside the attacker\'s firing arc and at Range 1 and the attacker is inside your firing arc, add 1 %EVADE% result.'
    },
    'Shadow Caster': {
      text: '<span class="card-restriction">Lancer-class Pursuit Craft only.</span>%LINEBREAK%After you perform an attack that hits, if the defender is inside your mobile firing arc and at Range 1-2, you may assign the defender 1 tractor beam token.'
    },
    'Sabine\'s Masterpiece': {
      text: '<span class="card-restriction">TIE Fighter only.</span>%REBELONLY%%LINEBREAK%Your upgrade bar gains the %CREW% and %ILLICIT% upgrade icons.'
    },
    'Kylo Ren\'s Shuttle': {
      text: '<span class="card-restriction">Upsilon-class Shuttle only.</span>%LINEBREAK%At the end of the Combat phase, choose an unstressed enemy ship at Range 1-2.  Its owner must assign a stress token to it or assign a stress token to another ship at Range 1-2 of you that that player controls.'
    },
    'Pivot Wing': {
      text: '<span class="card-restriction">U-Wing only.</span> %DUALCARD%%LINEBREAK%<strong>Side A (Attack):</strong> Increase your agility by 1.%LINEBREAK%After you execute a maneuver, you may flip this card.%LINEBREAK%<strong>Side B (Landing):</strong> When you reveal a (0 %STOP%) maneuver, you may rotate your ship 180&deg;.%LINEBREAK%After you execute a maneuver, you may flip this card.'
    },
    'Adaptive Ailerons': {
      text: '<span class="card-restriction">TIE Striker only.</span>%LINEBREAK%Immediately before you reveal your dial, if you are not stressed, you <strong>must</strong> execute a white (%BANKLEFT% 1), (%STRAIGHT% 1), or (%BANKRIGHT% 1) maneuver.'
    },
    'Merchant One': {
      text: '<span class="card-restriction">C-ROC Cruiser only.</span>%LINEBREAK%Your upgrade bar 1 gains additional %CREW% upgrade icon and 1 additional %TEAM% upgrade icon and loses 1 %CARGO% upgrade icon.'
    },
    '"Light Scyk" Interceptor': {
      text: '<span class="card-restriction">M3-A Interceptor only.</span>%LINEBREAK%All Damage cards dealt to you are dealt faceup.  You may treat all bank maneuvers (%BANKLEFT% or %BANKRIGHT%) as green maneuvers.  You cannot equip Modification upgrades.'
    },
    'Insatiable Worrt': {
      text: 'After you perform the recover action, gain 3 energy.'
    },
    'Broken Horn': {
      text: 'When defending, if you have a reinforce token, you may add 1 additional %EVADE% result.  If you do, after defending, discard your reinforce token.'
    },
    'Havoc': {
      text: '<span class="card-restriction">Scurrg H-6 Bomber only.</span>%LINEBREAK%Your upgrade bar gains the %SYSTEM% and %SALVAGEDASTROMECH% icons and loses the %CREW% upgrade icon.%LINEBREAK%You cannot equip non-unique %SALVAGEDASTROMECH% Upgrade cards.'
    },
    'Vaksai': {
      text: '<span class="card-restriction">Kihraxz Fighter only.</span>%LINEBREAK%The squad point cost of each of your equipped upgrades is reduced by 1 (to a minimum of 0).%LINEBREAK%You may equip up to 3 different Modification upgrades.'
    },
    'StarViper Mk. II': {
      text: '<span class="card-restriction">StarViper only.</span>%LINEBREAK%You may equip up to 2 different title Upgrades.%LINEBREAK%When performing a barrel roll action, you <strong>must</strong> use the (%BANKLEFT% 1) or (%BANKRIGHT% 1) template instead of the (%STRAIGHT% 1) template.'
    },
    'XG-1 Assault Configuration': {
      text: '<span class="card-restriction">Alpha-class Star Wing only.</span>%LINEBREAK%Your upgrade bar gains 2 %CANNON% icons.%LINEBREAK%You may perform attacks with %CANNON% secondary weapons that cost 2 or fewer points even while you have a weapons disabled token.'
    },
    'Enforcer': {
      text: '<span class="card-restriction">M12-L Kimogila Fighter only.</span>%LINEBREAK%After defending, if the attacker is inside your bullseye firing arc, the attacker receives 1 stress token.'
    },
    'Ghost (Phantom II)': {
      text: '<span class="card-restriction">VCX-100 only.</span>%LINEBREAK%Equip the <em>Phantom II</em> title card to a friendly <em>Sheathipede</em>-class shuttle and dock it to this ship.%LINEBREAK%After you execute a maneuver, you may deploy it from your rear guides.'
    },
    'Phantom II': {
      text: 'While you are docked, the <em>Ghost</em> can perform primary weapon attacks from its special firing arc.%LINEBREAK%While you are docked, at the end of the Activation phase, the <em>Ghost</em> may perform a free coordinate action.'
    },
    'First Order Vanguard': {
      text: '<span class="card-restriction">TIE Silencer only.</span>%LINEBREAK%When attacking, if the defender is the only ship in your firing arc at Range 1-3, you may reroll 1 attack die.%LINEBREAK%When defending, you may discard this card to reroll all of your defense dice.'
    }
  };
  condition_translations = {
    'I\'ll Show You the Dark Side': {
      text: 'When this card is assigned, if it is not already in play, the player who assigned it searches the Damage deck for 1 Damage card with the <strong><em>Pilot</em></strong> trait and may place it faceup on this card. Then shuffle the damage deck.%LINEBREAK%When you suffer critical damage during an attack, you are instead dealt the chosen faceup Damage card.%LINEBREAK%When there is no Damage card on this card, remove it.'
    },
    'Suppressive Fire': {
      text: 'When attacking a ship other than "Captain Rex," roll 1 fewer attack die.%LINEBREAK% When you declare an attack targeting "Captain Rex" or when "Captain Rex" is destroyed, remove this card.%LINEBREAK%At the end of the Combat phase, if "Captain Rex" did not perform an attack this phase, remove this card.'
    },
    'Fanatical Devotion': {
      text: 'When defending, you cannot spend focus tokens.%LINEBREAK%When attacking, if you spend a focus token to change all %FOCUS% results to %HIT% results, set aside the first %FOCUS% result that you change. The set-aside %HIT% result cannot be canceled by defense dice, but the defender may cancel %CRIT% results before it.%LINEBREAK%During the End phase, remove this card.'
    },
    'A Debt to Pay': {
      text: 'When attacking a ship that has the "A Score to Settle" Upgrade card equipped, you may change 1 %FOCUS% result to a %CRIT% result.'
    },
    'Shadowed': {
      text: '"Thweek" is treated as having the pilot skill value you had after setup.%LINEBREAK%The pilot skill value of "Thweek" does not change if your pilot skill value changes or you are destroyed.'
    },
    'Mimicked': {
      text: '"Thweek" is treated as having your pilot ability.%LINEBREAK%"Thweek" cannot apply a Condition card by using your pilot ability.%LINEBREAK%"Thweek" does not lose your pilot ability if you are destroyed.'
    },
    'Harpooned!': {
      text: 'When you are hit by an attack, if there is at least 1 uncanceled %CRIT% result, each other ship at Range 1 suffers 1 damage.  Then discard this card and receive 1 facedown Damage card.%LINEBREAK%When you are destroyed, each ship at Range 1 suffers 1 damage.%LINEBREAK%<strong>Action:</strong> Discard this card.  Then roll 1 attack die.  On a %HIT% or %CRIT% result, suffer 1 damage.'
    },
    'Rattled': {
      text: 'When you suffer damage from a bomb, you suffer 1 additional critical damage. Then, remove this card.%LINEBREAK%<strong>Action:</strong> Roll 1 attack die. On a %FOCUS% or %HIT% result, remove this card.'
    }
  };
  return exportObj.setupCardData(basic_cards, pilot_translations, upgrade_translations, modification_translations, title_translations, condition_translations);
};

exportObj = typeof exports !== "undefined" && exports !== null ? exports : this;

if ((_base = String.prototype).startsWith == null) {
  _base.startsWith = function(t) {
    return this.indexOf(t === 0);
  };
}

sortWithoutQuotes = function(a, b) {
  var a_name, b_name;
  a_name = a.replace(/[^a-z0-9]/ig, '');
  b_name = b.replace(/[^a-z0-9]/ig, '');
  if (a_name < b_name) {
    return -1;
  } else if (a_name > b_name) {
    return 1;
  } else {
    return 0;
  }
};

exportObj.manifestByExpansion = {
  'Core': [
    {
      name: 'X-Wing',
      type: 'ship',
      count: 1
    }, {
      name: 'TIE Fighter',
      type: 'ship',
      count: 2
    }, {
      name: 'Luke Skywalker',
      type: 'pilot',
      count: 1
    }, {
      name: 'Luke Skywalker.',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Biggs Darklighter',
      type: 'pilot',
      count: 1
    }, {
      name: 'Biggs Darklighter',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Red Squadron Pilot',
      type: 'pilot',
      count: 1
    }, {
      name: 'Rookie Pilot',
      type: 'pilot',
      count: 1
    }, {
      name: '"Mauler Mithel"',
      type: 'pilot',
      count: 1
    }, {
      name: '"Mauler Mithel"',
      type: 'upgrade',
      count: 1
    }, {
      name: '"Dark Curse"',
      type: 'pilot',
      count: 1
    }, {
      name: '"Dark Curse"',
      type: 'upgrade',
      count: 1
    }, {
      name: '"Night Beast"',
      type: 'pilot',
      count: 1
    }, {
      name: '"Night Beast"',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Black Squadron Pilot',
      type: 'pilot',
      count: 2
    }, {
      name: 'Obsidian Squadron Pilot',
      type: 'pilot',
      count: 2
    }, {
      name: 'Academy Pilot',
      type: 'pilot',
      count: 2
    }, {
      name: 'Proton Torpedoes',
      type: 'upgrade',
      count: 1
    }, {
      name: 'R2-F2',
      type: 'upgrade',
      count: 1
    }, {
      name: 'R2-D2',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Determination',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Marksmanship',
      type: 'upgrade',
      count: 1
    }
  ],
  'X-Wing Expansion Pack': [
    {
      name: 'X-Wing',
      type: 'ship',
      count: 1
    }, {
      name: 'Wedge Antilles',
      type: 'pilot',
      count: 1
    }, {
      name: 'Garven Dreis',
      type: 'pilot',
      count: 1
    }, {
      name: 'Wedge Antilles',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Garven Dreis',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Red Squadron Pilot',
      type: 'pilot',
      count: 1
    }, {
      name: 'Rookie Pilot',
      type: 'pilot',
      count: 1
    }, {
      name: 'Proton Torpedoes',
      type: 'upgrade',
      count: 1
    }, {
      name: 'R5-K6',
      type: 'upgrade',
      count: 1
    }, {
      name: 'R5 Astromech',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Expert Handling',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Marksmanship',
      type: 'upgrade',
      count: 1
    }
  ],
  'Y-Wing Expansion Pack': [
    {
      name: 'Y-Wing',
      type: 'ship',
      count: 1
    }, {
      name: 'Horton Salm',
      type: 'pilot',
      count: 1
    }, {
      name: '"Dutch" Vander',
      type: 'pilot',
      count: 1
    }, {
      name: 'Horton Salm',
      type: 'upgrade',
      count: 1
    }, {
      name: '"Dutch" Vander',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Gray Squadron Pilot',
      type: 'pilot',
      count: 1
    }, {
      name: 'Gold Squadron Pilot',
      type: 'pilot',
      count: 1
    }, {
      name: 'Proton Torpedoes',
      type: 'upgrade',
      count: 2
    }, {
      name: 'Ion Cannon Turret',
      type: 'upgrade',
      count: 1
    }, {
      name: 'R5-D8',
      type: 'upgrade',
      count: 1
    }, {
      name: 'R2 Astromech',
      type: 'upgrade',
      count: 1
    }
  ],
  'TIE Fighter Expansion Pack': [
    {
      name: 'TIE Fighter',
      type: 'ship',
      count: 1
    }, {
      name: '"Howlrunner"',
      type: 'pilot',
      count: 1
    }, {
      name: '"Backstabber"',
      type: 'pilot',
      count: 1
    }, {
      name: '"Winged Gundark"',
      type: 'pilot',
      count: 1
    }, {
      name: '"Howlrunner"',
      type: 'upgrade',
      count: 1
    }, {
      name: '"Backstabber"',
      type: 'upgrade',
      count: 1
    }, {
      name: '"Winged Gundark"',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Black Squadron Pilot',
      type: 'pilot',
      count: 1
    }, {
      name: 'Obsidian Squadron Pilot',
      type: 'pilot',
      count: 1
    }, {
      name: 'Academy Pilot',
      type: 'pilot',
      count: 1
    }, {
      name: 'Swarm Tactics',
      type: 'upgrade',
      count: 1
    }
  ],
  'TIE Advanced Expansion Pack': [
    {
      name: 'TIE Advanced',
      type: 'ship',
      count: 1
    }, {
      name: 'Darth Vader',
      type: 'pilot',
      count: 1
    }, {
      name: 'Maarek Stele',
      type: 'pilot',
      count: 1
    }, {
      name: 'Darth Vader.',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Maarek Stele',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Storm Squadron Pilot',
      type: 'pilot',
      count: 1
    }, {
      name: 'Tempest Squadron Pilot',
      type: 'pilot',
      count: 1
    }, {
      name: 'Concussion Missiles',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Cluster Missiles',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Squad Leader',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Swarm Tactics',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Expert Handling',
      type: 'upgrade',
      count: 1
    }
  ],
  'A-Wing Expansion Pack': [
    {
      name: 'A-Wing',
      type: 'ship',
      count: 1
    }, {
      name: 'Tycho Celchu',
      type: 'pilot',
      count: 1
    }, {
      name: 'Arvel Crynyd',
      type: 'pilot',
      count: 1
    }, {
      name: 'Tycho Celchu',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Arvel Crynyd',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Green Squadron Pilot',
      type: 'pilot',
      count: 1
    }, {
      name: 'Prototype Pilot',
      type: 'pilot',
      count: 1
    }, {
      name: 'Concussion Missiles',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Homing Missiles',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Cluster Missiles',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Push the Limit',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Deadeye',
      type: 'upgrade',
      count: 1
    }
  ],
  'Millennium Falcon Expansion Pack': [
    {
      name: 'YT-1300',
      type: 'ship',
      count: 1
    }, {
      name: 'Han Solo',
      type: 'pilot',
      count: 1
    }, {
      name: 'Lando Calrissian',
      type: 'pilot',
      count: 1
    }, {
      name: 'Chewbacca',
      type: 'pilot',
      count: 1
    }, {
      name: 'Han Solo.',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Lando Calrissian.',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Chewbacca.',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Outer Rim Smuggler',
      type: 'pilot',
      count: 1
    }, {
      name: 'Concussion Missiles',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Assault Missiles',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Elusiveness',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Draw Their Fire',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Veteran Instincts',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Luke Skywalker',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Nien Nunb',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Chewbacca',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Weapons Engineer',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Shield Upgrade',
      type: 'modification',
      count: 2
    }, {
      name: 'Engine Upgrade',
      type: 'modification',
      count: 2
    }, {
      name: 'Millennium Falcon',
      type: 'title',
      count: 1
    }
  ],
  'TIE Interceptor Expansion Pack': [
    {
      name: 'TIE Interceptor',
      type: 'ship',
      count: 1
    }, {
      name: 'Soontir Fel',
      type: 'pilot',
      count: 1
    }, {
      name: 'Turr Phennir',
      type: 'pilot',
      count: 1
    }, {
      name: '"Fel\'s Wrath"',
      type: 'pilot',
      count: 1
    }, {
      name: 'Soontir Fel',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Turr Phennir',
      type: 'upgrade',
      count: 1
    }, {
      name: '"Fel\'s Wrath"',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Saber Squadron Pilot',
      type: 'pilot',
      count: 1
    }, {
      name: 'Avenger Squadron Pilot',
      type: 'pilot',
      count: 1
    }, {
      name: 'Alpha Squadron Pilot',
      type: 'pilot',
      count: 1
    }, {
      name: 'Daredevil',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Elusiveness',
      type: 'upgrade',
      count: 1
    }
  ],
  'Slave I Expansion Pack': [
    {
      name: 'Firespray-31',
      type: 'ship',
      count: 1
    }, {
      name: 'Boba Fett',
      type: 'pilot',
      count: 1
    }, {
      name: 'Kath Scarlet',
      type: 'pilot',
      count: 1
    }, {
      name: 'Krassis Trelix',
      type: 'pilot',
      count: 1
    }, {
      name: 'Boba Fett.',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Kath Scarlet',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Krassis Trelix',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Bounty Hunter',
      type: 'pilot',
      count: 1
    }, {
      name: 'Homing Missiles',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Assault Missiles',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Ion Cannon',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Heavy Laser Cannon',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Veteran Instincts',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Expose',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Seismic Charges',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Proximity Mines',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Gunner',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Mercenary Copilot',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Stealth Device',
      type: 'modification',
      count: 2
    }, {
      name: 'Slave I',
      type: 'title',
      count: 1
    }
  ],
  'B-Wing Expansion Pack': [
    {
      name: 'B-Wing',
      type: 'ship',
      count: 1
    }, {
      name: 'Ten Numb',
      type: 'pilot',
      count: 1
    }, {
      name: 'Ibtisam',
      type: 'pilot',
      count: 1
    }, {
      name: 'Ten Numb',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Ibtisam',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Dagger Squadron Pilot',
      type: 'pilot',
      count: 1
    }, {
      name: 'Blue Squadron Pilot',
      type: 'pilot',
      count: 1
    }, {
      name: 'Fire-Control System',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Advanced Proton Torpedoes',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Proton Torpedoes',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Ion Cannon',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Autoblaster',
      type: 'upgrade',
      count: 1
    }
  ],
  "HWK-290 Expansion Pack": [
    {
      name: 'HWK-290',
      type: 'ship',
      count: 1
    }, {
      name: 'Jan Ors',
      type: 'pilot',
      count: 1
    }, {
      name: 'Kyle Katarn',
      type: 'pilot',
      count: 1
    }, {
      name: 'Roark Garnet',
      type: 'pilot',
      count: 1
    }, {
      name: 'Jan Ors.',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Kyle Katarn.',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Roark Garnet',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Rebel Operative',
      type: 'pilot',
      count: 1
    }, {
      name: 'Ion Cannon Turret',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Recon Specialist',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Moldy Crow',
      type: 'title',
      count: 1
    }, {
      name: 'Blaster Turret',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Saboteur',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Intelligence Agent',
      type: 'upgrade',
      count: 1
    }
  ],
  "TIE Bomber Expansion Pack": [
    {
      name: 'TIE Bomber',
      type: 'ship',
      count: 1
    }, {
      name: 'Major Rhymer',
      type: 'pilot',
      count: 1
    }, {
      name: 'Captain Jonus',
      type: 'pilot',
      count: 1
    }, {
      name: 'Major Rhymer',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Captain Jonus',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Gamma Squadron Pilot',
      type: 'pilot',
      count: 1
    }, {
      name: 'Scimitar Squadron Pilot',
      type: 'pilot',
      count: 1
    }, {
      name: 'Proton Bombs',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Assault Missiles',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Advanced Proton Torpedoes',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Seismic Charges',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Adrenaline Rush',
      type: 'upgrade',
      count: 1
    }
  ],
  "Lambda-Class Shuttle Expansion Pack": [
    {
      name: 'Lambda-Class Shuttle',
      type: 'ship',
      count: 1
    }, {
      name: 'Captain Kagi',
      type: 'pilot',
      count: 1
    }, {
      name: 'Colonel Jendon',
      type: 'pilot',
      count: 1
    }, {
      name: 'Captain Yorr',
      type: 'pilot',
      count: 1
    }, {
      name: 'Captain Kagi',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Colonel Jendon',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Captain Yorr',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Omicron Group Pilot',
      type: 'pilot',
      count: 1
    }, {
      name: 'Sensor Jammer',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Rebel Captive',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Advanced Sensors',
      type: 'upgrade',
      count: 1
    }, {
      name: 'ST-321',
      type: 'title',
      count: 1
    }, {
      name: 'Heavy Laser Cannon',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Weapons Engineer',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Darth Vader',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Intelligence Agent',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Navigator',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Flight Instructor',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Anti-Pursuit Lasers',
      type: 'modification',
      count: 2
    }
  ],
  "Z-95 Headhunter Expansion Pack": [
    {
      name: 'Z-95 Headhunter',
      type: 'ship',
      count: 1
    }, {
      name: 'Airen Cracken',
      type: 'pilot',
      count: 1
    }, {
      name: 'Lieutenant Blount',
      type: 'pilot',
      count: 1
    }, {
      name: 'Airen Cracken',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Lieutenant Blount',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Tala Squadron Pilot',
      type: 'pilot',
      count: 1
    }, {
      name: 'Bandit Squadron Pilot',
      type: 'pilot',
      count: 1
    }, {
      name: 'Munitions Failsafe',
      type: 'modification',
      count: 1
    }, {
      name: 'Decoy',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Wingman',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Ion Pulse Missiles',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Assault Missiles',
      type: 'upgrade',
      count: 1
    }
  ],
  'E-Wing Expansion Pack': [
    {
      name: 'E-Wing',
      type: 'ship',
      count: 1
    }, {
      name: 'Corran Horn',
      type: 'pilot',
      count: 1
    }, {
      name: "Etahn A'baht",
      type: 'pilot',
      count: 1
    }, {
      name: 'Corran Horn',
      type: 'upgrade',
      count: 1
    }, {
      name: "Etahn A'baht",
      type: 'upgrade',
      count: 1
    }, {
      name: 'Blackmoon Squadron Pilot',
      type: 'pilot',
      count: 1
    }, {
      name: 'Knave Squadron Pilot',
      type: 'pilot',
      count: 1
    }, {
      name: 'Advanced Sensors',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Outmaneuver',
      type: 'upgrade',
      count: 1
    }, {
      name: 'R7-T1',
      type: 'upgrade',
      count: 1
    }, {
      name: 'R7 Astromech',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Flechette Torpedoes',
      type: 'upgrade',
      count: 1
    }
  ],
  'TIE Defender Expansion Pack': [
    {
      name: 'TIE Defender',
      type: 'ship',
      count: 1
    }, {
      name: 'Rexler Brath',
      type: 'pilot',
      count: 1
    }, {
      name: 'Colonel Vessery',
      type: 'pilot',
      count: 1
    }, {
      name: 'Rexler Brath',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Colonel Vessery',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Onyx Squadron Pilot',
      type: 'pilot',
      count: 1
    }, {
      name: 'Delta Squadron Pilot',
      type: 'pilot',
      count: 1
    }, {
      name: 'Munitions Failsafe',
      type: 'modification',
      count: 1
    }, {
      name: 'Predator',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Outmaneuver',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Ion Cannon',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Ion Pulse Missiles',
      type: 'upgrade',
      count: 1
    }
  ],
  'TIE Phantom Expansion Pack': [
    {
      name: 'TIE Phantom',
      type: 'ship',
      count: 1
    }, {
      name: '"Whisper"',
      type: 'pilot',
      count: 1
    }, {
      name: '"Echo"',
      type: 'pilot',
      count: 1
    }, {
      name: '"Whisper"',
      type: 'upgrade',
      count: 1
    }, {
      name: '"Echo"',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Shadow Squadron Pilot',
      type: 'pilot',
      count: 1
    }, {
      name: 'Sigma Squadron Pilot',
      type: 'pilot',
      count: 1
    }, {
      name: 'Fire-Control System',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Tactician',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Recon Specialist',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Advanced Cloaking Device',
      type: 'modification',
      count: 1
    }, {
      name: 'Stygium Particle Accelerator',
      type: 'modification',
      count: 1
    }
  ],
  'YT-2400 Freighter Expansion Pack': [
    {
      name: 'YT-2400',
      type: 'ship',
      count: 1
    }, {
      name: 'Dash Rendar',
      type: 'pilot',
      count: 1
    }, {
      name: 'Eaden Vrill',
      type: 'pilot',
      count: 1
    }, {
      name: '"Leebo"',
      type: 'pilot',
      count: 1
    }, {
      name: 'Dash Rendar.',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Eaden Vrill',
      type: 'upgrade',
      count: 1
    }, {
      name: '"Leebo".',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Wild Space Fringer',
      type: 'pilot',
      count: 1
    }, {
      name: 'Experimental Interface',
      type: 'modification',
      count: 1
    }, {
      name: 'Countermeasures',
      type: 'modification',
      count: 2
    }, {
      name: 'Outrider',
      type: 'title',
      count: 1
    }, {
      name: 'Lone Wolf',
      type: 'upgrade',
      count: 1
    }, {
      name: '"Leebo"',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Lando Calrissian',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Stay On Target',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Dash Rendar',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Gunner',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Mercenary Copilot',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Proton Rockets',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Heavy Laser Cannon',
      type: 'upgrade',
      count: 1
    }
  ],
  "VT-49 Decimator Expansion Pack": [
    {
      name: 'VT-49 Decimator',
      type: 'ship',
      count: 1
    }, {
      name: 'Captain Oicunn',
      type: 'pilot',
      count: 1
    }, {
      name: 'Rear Admiral Chiraneau',
      type: 'pilot',
      count: 1
    }, {
      name: 'Commander Kenkirk',
      type: 'pilot',
      count: 1
    }, {
      name: 'Captain Oicunn',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Rear Admiral Chiraneau',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Commander Kenkirk',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Patrol Leader',
      type: 'pilot',
      count: 1
    }, {
      name: 'Ruthlessness',
      type: 'upgrade',
      count: 2
    }, {
      name: 'Dauntless',
      type: 'title',
      count: 1
    }, {
      name: 'Ysanne Isard',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Moff Jerjerrod',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Intimidation',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Tactical Jammer',
      type: 'modification',
      count: 2
    }, {
      name: 'Proton Bombs',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Mara Jade',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Fleet Officer',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Ion Torpedoes',
      type: 'upgrade',
      count: 2
    }
  ],
  'Imperial Aces Expansion Pack': [
    {
      name: 'TIE Interceptor',
      type: 'ship',
      count: 2
    }, {
      name: 'Carnor Jax',
      type: 'pilot',
      count: 1
    }, {
      name: 'Kir Kanos',
      type: 'pilot',
      count: 1
    }, {
      name: 'Royal Guard Pilot',
      type: 'pilot',
      count: 2
    }, {
      name: 'Tetran Cowall',
      type: 'pilot',
      count: 1
    }, {
      name: 'Lieutenant Lorrir',
      type: 'pilot',
      count: 1
    }, {
      name: 'Carnor Jax',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Kir Kanos',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Tetran Cowall',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Lieutenant Lorrir',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Saber Squadron Pilot',
      type: 'pilot',
      count: 2
    }, {
      name: 'Royal Guard TIE',
      type: 'title',
      count: 2
    }, {
      name: 'Targeting Computer',
      type: 'modification',
      count: 2
    }, {
      name: 'Hull Upgrade',
      type: 'modification',
      count: 2
    }, {
      name: 'Push the Limit',
      type: 'upgrade',
      count: 2
    }, {
      name: 'Opportunist',
      type: 'upgrade',
      count: 2
    }, {
      name: 'Shield Upgrade',
      type: 'modification',
      count: 2
    }
  ],
  'Rebel Aces Expansion Pack': [
    {
      name: 'A-Wing',
      type: 'ship',
      count: 1
    }, {
      name: 'B-Wing',
      type: 'ship',
      count: 1
    }, {
      name: 'Jake Farrell',
      type: 'pilot',
      count: 1
    }, {
      name: 'Gemmer Sojan',
      type: 'pilot',
      count: 1
    }, {
      name: 'Jake Farrell',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Gemmer Sojan',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Green Squadron Pilot',
      type: 'pilot',
      count: 1
    }, {
      name: 'Prototype Pilot',
      type: 'pilot',
      count: 1
    }, {
      name: 'Keyan Farlander',
      type: 'pilot',
      count: 1
    }, {
      name: 'Nera Dantels',
      type: 'pilot',
      count: 1
    }, {
      name: 'Keyan Farlander',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Nera Dantels',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Dagger Squadron Pilot',
      type: 'pilot',
      count: 1
    }, {
      name: 'Blue Squadron Pilot',
      type: 'pilot',
      count: 1
    }, {
      name: 'Chardaan Refit',
      type: 'upgrade',
      count: 3
    }, {
      name: 'A-Wing Test Pilot',
      type: 'title',
      count: 2
    }, {
      name: 'Enhanced Scopes',
      type: 'upgrade',
      count: 2
    }, {
      name: 'Proton Rockets',
      type: 'upgrade',
      count: 2
    }, {
      name: 'B-Wing/E2',
      type: 'modification',
      count: 2
    }, {
      name: 'Kyle Katarn',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Jan Ors',
      type: 'upgrade',
      count: 1
    }
  ],
  'Rebel Transport Expansion Pack': [
    {
      name: 'X-Wing',
      type: 'ship',
      count: 1
    }, {
      name: 'GR-75 Medium Transport',
      type: 'ship',
      count: 1
    }, {
      name: 'GR-75 Medium Transport',
      type: 'pilot',
      count: 1
    }, {
      name: 'Wes Janson',
      type: 'pilot',
      count: 1
    }, {
      name: 'Jek Porkins',
      type: 'pilot',
      count: 1
    }, {
      name: '"Hobbie" Klivian',
      type: 'pilot',
      count: 1
    }, {
      name: 'Tarn Mison',
      type: 'pilot',
      count: 1
    }, {
      name: 'Wes Janson',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Jek Porkins',
      type: 'upgrade',
      count: 1
    }, {
      name: '"Hobbie" Klivian',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Tarn Mison',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Red Squadron Pilot',
      type: 'pilot',
      count: 1
    }, {
      name: 'Rookie Pilot',
      type: 'pilot',
      count: 1
    }, {
      name: 'Dutyfree',
      type: 'title',
      count: 1
    }, {
      name: 'Quantum Storm',
      type: 'title',
      count: 1
    }, {
      name: 'Bright Hope',
      type: 'title',
      count: 1
    }, {
      name: 'Expanded Cargo Hold',
      type: 'upgrade',
      count: 1
    }, {
      name: 'R2-D6',
      type: 'upgrade',
      count: 1
    }, {
      name: 'R4-D6',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Flechette Torpedoes',
      type: 'upgrade',
      count: 3
    }, {
      name: 'R3-A2',
      type: 'upgrade',
      count: 1
    }, {
      name: 'WED-15 Repair Droid',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Backup Shield Generator',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Carlist Rieekan',
      type: 'upgrade',
      count: 1
    }, {
      name: 'EM Emitter',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Engine Booster',
      type: 'upgrade',
      count: 1
    }, {
      name: 'R5-P9',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Comms Booster',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Frequency Jammer',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Shield Projector',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Tibanna Gas Supplies',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Jan Dodonna',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Toryn Farr',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Slicer Tools',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Combat Retrofit',
      type: 'modification',
      count: 1
    }
  ],
  'Tantive IV Expansion Pack': [
    {
      name: 'CR90 Corvette (Fore)',
      type: 'ship',
      count: 1
    }, {
      name: 'CR90 Corvette (Aft)',
      type: 'ship',
      count: 1
    }, {
      name: 'CR90 Corvette (Fore)',
      type: 'pilot',
      count: 1
    }, {
      name: 'CR90 Corvette (Aft)',
      type: 'pilot',
      count: 1
    }, {
      name: "Jaina's Light",
      type: 'title',
      count: 1
    }, {
      name: "Dodonna's Pride",
      type: 'title',
      count: 1
    }, {
      name: 'Tantive IV',
      type: 'title',
      count: 1
    }, {
      name: 'Backup Shield Generator',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Han Solo',
      type: 'upgrade',
      count: 1
    }, {
      name: 'C-3PO',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Engine Booster',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Comms Booster',
      type: 'upgrade',
      count: 2
    }, {
      name: 'Engineering Team',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Gunnery Team',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Ionization Reactor',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Leia Organa',
      type: 'upgrade',
      count: 1
    }, {
      name: 'R2-D2 (Crew)',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Sensor Team',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Targeting Coordinator',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Tibanna Gas Supplies',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Raymus Antilles',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Quad Laser Cannons',
      type: 'upgrade',
      count: 3
    }, {
      name: 'Single Turbolasers',
      type: 'upgrade',
      count: 3
    }
  ],
  'StarViper Expansion Pack': [
    {
      name: 'StarViper',
      type: 'ship',
      count: 1
    }, {
      name: 'Prince Xizor',
      type: 'pilot',
      count: 1
    }, {
      name: 'Guri',
      type: 'pilot',
      count: 1
    }, {
      name: 'Prince Xizor',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Guri',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Black Sun Vigo',
      type: 'pilot',
      count: 1
    }, {
      name: 'Black Sun Enforcer',
      type: 'pilot',
      count: 1
    }, {
      name: 'Virago',
      type: 'title',
      count: 1
    }, {
      name: 'Bodyguard',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Accuracy Corrector',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Inertial Dampeners',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Autothrusters',
      type: 'modification',
      count: 2
    }, {
      name: 'Calculation',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Ion Torpedoes',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Hull Upgrade',
      type: 'modification',
      count: 1
    }
  ],
  "M3-A Interceptor Expansion Pack": [
    {
      name: 'M3-A Interceptor',
      type: 'ship',
      count: 1
    }, {
      name: 'Serissu',
      type: 'pilot',
      count: 1
    }, {
      name: "Laetin A'shera",
      type: 'pilot',
      count: 1
    }, {
      name: 'Serissu',
      type: 'upgrade',
      count: 1
    }, {
      name: "Laetin A'shera",
      type: 'upgrade',
      count: 1
    }, {
      name: "Tansarii Point Veteran",
      type: 'pilot',
      count: 1
    }, {
      name: "Cartel Spacer",
      type: 'pilot',
      count: 1
    }, {
      name: '"Heavy Scyk" Interceptor',
      type: 'title',
      count: 1,
      skipForSource: true
    }, {
      name: '"Heavy Scyk" Interceptor (Cannon)',
      type: 'title',
      count: 0
    }, {
      name: '"Heavy Scyk" Interceptor (Missile)',
      type: 'title',
      count: 0
    }, {
      name: '"Heavy Scyk" Interceptor (Torpedo)',
      type: 'title',
      count: 0
    }, {
      name: 'Flechette Cannon',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Ion Cannon',
      type: 'upgrade',
      count: 1
    }, {
      name: '"Mangler" Cannon',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Stealth Device',
      type: 'modification',
      count: 1
    }
  ],
  "IG-2000 Expansion Pack": [
    {
      name: 'Aggressor',
      type: 'ship',
      count: 1
    }, {
      name: 'IG-88A',
      type: 'pilot',
      count: 1
    }, {
      name: 'IG-88B',
      type: 'pilot',
      count: 1
    }, {
      name: 'IG-88C',
      type: 'pilot',
      count: 1
    }, {
      name: 'IG-88D',
      type: 'pilot',
      count: 1
    }, {
      name: 'IG-88A',
      type: 'upgrade',
      count: 1
    }, {
      name: 'IG-88B',
      type: 'upgrade',
      count: 1
    }, {
      name: 'IG-88C',
      type: 'upgrade',
      count: 1
    }, {
      name: 'IG-88D.',
      type: 'upgrade',
      count: 1
    }, {
      name: 'IG-2000',
      type: 'title',
      count: 1
    }, {
      name: 'Accuracy Corrector',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Autoblaster',
      type: 'upgrade',
      count: 1
    }, {
      name: '"Mangler" Cannon',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Proximity Mines',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Seismic Charges',
      type: 'upgrade',
      count: 1
    }, {
      name: "Dead Man's Switch",
      type: 'upgrade',
      count: 2
    }, {
      name: 'Feedback Array',
      type: 'upgrade',
      count: 2
    }, {
      name: '"Hot Shot" Blaster',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Inertial Dampeners',
      type: 'upgrade',
      count: 1
    }
  ],
  "Most Wanted Expansion Pack": [
    {
      name: 'Z-95 Headhunter',
      type: 'ship',
      count: 2
    }, {
      name: 'Y-Wing',
      type: 'ship',
      count: 1
    }, {
      name: "N'Dru Suhlak",
      type: 'pilot',
      count: 1
    }, {
      name: "Kaa'to Leeachos",
      type: 'pilot',
      count: 1
    }, {
      name: "N'Dru Suhlak",
      type: 'upgrade',
      count: 1
    }, {
      name: "Kaa'to Leeachos",
      type: 'upgrade',
      count: 1
    }, {
      name: "Black Sun Soldier",
      type: 'pilot',
      count: 2
    }, {
      name: "Binayre Pirate",
      type: 'pilot',
      count: 2
    }, {
      name: "Kavil",
      type: 'pilot',
      count: 1
    }, {
      name: "Drea Renthal",
      type: 'pilot',
      count: 1
    }, {
      name: "Kavil",
      type: 'upgrade',
      count: 1
    }, {
      name: "Drea Renthal",
      type: 'upgrade',
      count: 1
    }, {
      name: "Hired Gun",
      type: 'pilot',
      count: 2
    }, {
      name: "Syndicate Thug",
      type: 'pilot',
      count: 2
    }, {
      name: "Boba Fett (Scum)",
      type: 'pilot',
      count: 1
    }, {
      name: "Kath Scarlet (Scum)",
      type: 'pilot',
      count: 1
    }, {
      name: "Emon Azzameen",
      type: 'pilot',
      count: 1
    }, {
      name: "Boba Fett (Scum).",
      type: 'upgrade',
      count: 1
    }, {
      name: "Kath Scarlet (Scum)",
      type: 'upgrade',
      count: 1
    }, {
      name: "Emon Azzameen",
      type: 'upgrade',
      count: 1
    }, {
      name: "Mandalorian Mercenary",
      type: 'pilot',
      count: 1
    }, {
      name: "Dace Bonearm",
      type: 'pilot',
      count: 1
    }, {
      name: "Palob Godalhi",
      type: 'pilot',
      count: 1
    }, {
      name: "Torkil Mux",
      type: 'pilot',
      count: 1
    }, {
      name: "Dace Bonearm",
      type: 'upgrade',
      count: 1
    }, {
      name: "Palob Godalhi",
      type: 'upgrade',
      count: 1
    }, {
      name: "Torkil Mux",
      type: 'upgrade',
      count: 1
    }, {
      name: "Spice Runner",
      type: 'pilot',
      count: 1
    }, {
      name: "Greedo",
      type: 'upgrade',
      count: 1
    }, {
      name: "K4 Security Droid",
      type: 'upgrade',
      count: 1
    }, {
      name: "Outlaw Tech",
      type: 'upgrade',
      count: 1
    }, {
      name: "Autoblaster Turret",
      type: 'upgrade',
      count: 2
    }, {
      name: "Bomb Loadout",
      type: 'upgrade',
      count: 2
    }, {
      name: "R4-B11",
      type: 'upgrade',
      count: 1
    }, {
      name: '"Genius"',
      type: 'upgrade',
      count: 1
    }, {
      name: "R4 Agromech",
      type: 'upgrade',
      count: 2
    }, {
      name: "Salvaged Astromech",
      type: 'upgrade',
      count: 2
    }, {
      name: "Unhinged Astromech",
      type: 'upgrade',
      count: 2
    }, {
      name: "BTL-A4 Y-Wing",
      type: 'title',
      count: 2
    }, {
      name: "Andrasta",
      type: 'title',
      count: 1
    }, {
      name: '"Hot Shot" Blaster',
      type: 'upgrade',
      count: 1
    }
  ],
  "Hound's Tooth Expansion Pack": [
    {
      name: 'YV-666',
      type: 'ship',
      count: 1
    }, {
      name: 'Bossk',
      type: 'pilot',
      count: 1
    }, {
      name: 'Moralo Eval',
      type: 'pilot',
      count: 1
    }, {
      name: 'Latts Razzi',
      type: 'pilot',
      count: 1
    }, {
      name: 'Bossk.',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Moralo Eval',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Latts Razzi.',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Trandoshan Slaver',
      type: 'pilot',
      count: 1
    }, {
      name: 'Lone Wolf',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Crack Shot',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Stay On Target',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Heavy Laser Cannon',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Bossk',
      type: 'upgrade',
      count: 1
    }, {
      name: 'K4 Security Droid',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Outlaw Tech',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Glitterstim',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Engine Upgrade',
      type: 'modification',
      count: 1
    }, {
      name: 'Ion Projector',
      type: 'modification',
      count: 2
    }, {
      name: 'Maneuvering Fins',
      type: 'modification',
      count: 1
    }, {
      name: "Hound's Tooth",
      type: 'title',
      count: 1
    }
  ],
  'Kihraxz Fighter Expansion Pack': [
    {
      name: 'Kihraxz Fighter',
      type: 'ship',
      count: 1
    }, {
      name: 'Talonbane Cobra',
      type: 'pilot',
      count: 1
    }, {
      name: 'Graz the Hunter',
      type: 'pilot',
      count: 1
    }, {
      name: 'Talonbane Cobra',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Graz the Hunter',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Black Sun Ace',
      type: 'pilot',
      count: 1
    }, {
      name: 'Cartel Marauder',
      type: 'pilot',
      count: 1
    }, {
      name: 'Crack Shot',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Lightning Reflexes',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Predator',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Homing Missiles',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Glitterstim',
      type: 'upgrade',
      count: 1
    }
  ],
  'K-Wing Expansion Pack': [
    {
      name: 'K-Wing',
      type: 'ship',
      count: 1
    }, {
      name: 'Miranda Doni',
      type: 'pilot',
      count: 1
    }, {
      name: 'Esege Tuketu',
      type: 'pilot',
      count: 1
    }, {
      name: 'Miranda Doni',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Esege Tuketu',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Guardian Squadron Pilot',
      type: 'pilot',
      count: 1
    }, {
      name: 'Warden Squadron Pilot',
      type: 'pilot',
      count: 1
    }, {
      name: 'Twin Laser Turret',
      type: 'upgrade',
      count: 2
    }, {
      name: 'Plasma Torpedoes',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Advanced Homing Missiles',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Bombardier',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Conner Net',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Extra Munitions',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Ion Bombs',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Advanced SLAM',
      type: 'modification',
      count: 1
    }
  ],
  'TIE Punisher Expansion Pack': [
    {
      name: 'TIE Punisher',
      type: 'ship',
      count: 1
    }, {
      name: '"Redline"',
      type: 'pilot',
      count: 1
    }, {
      name: '"Deathrain"',
      type: 'pilot',
      count: 1
    }, {
      name: '"Redline"',
      type: 'upgrade',
      count: 1
    }, {
      name: '"Deathrain"',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Black Eight Squadron Pilot',
      type: 'pilot',
      count: 1
    }, {
      name: 'Cutlass Squadron Pilot',
      type: 'pilot',
      count: 1
    }, {
      name: 'Enhanced Scopes',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Extra Munitions',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Flechette Torpedoes',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Plasma Torpedoes',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Advanced Homing Missiles',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Cluster Mines',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Ion Bombs',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Twin Ion Engine Mk. II',
      type: 'modification',
      count: 2
    }
  ],
  "Imperial Raider Expansion Pack": [
    {
      name: "Raider-class Corvette (Fore)",
      type: 'ship',
      count: 1
    }, {
      name: "Raider-class Corvette (Aft)",
      type: 'ship',
      count: 1
    }, {
      name: "TIE Advanced",
      type: 'ship',
      count: 1
    }, {
      name: "Raider-class Corvette (Fore)",
      type: 'pilot',
      count: 1
    }, {
      name: "Raider-class Corvette (Aft)",
      type: 'pilot',
      count: 1
    }, {
      name: "Juno Eclipse",
      type: 'pilot',
      count: 1
    }, {
      name: "Zertik Strom",
      type: 'pilot',
      count: 1
    }, {
      name: "Commander Alozen",
      type: 'pilot',
      count: 1
    }, {
      name: "Lieutenant Colzet",
      type: 'pilot',
      count: 1
    }, {
      name: "Juno Eclipse",
      type: 'upgrade',
      count: 1
    }, {
      name: "Zertik Strom",
      type: 'upgrade',
      count: 1
    }, {
      name: "Commander Alozen",
      type: 'upgrade',
      count: 1
    }, {
      name: "Lieutenant Colzet",
      type: 'upgrade',
      count: 1
    }, {
      name: "Storm Squadron Pilot",
      type: 'pilot',
      count: 1
    }, {
      name: "Tempest Squadron Pilot",
      type: 'pilot',
      count: 1
    }, {
      name: "Advanced Targeting Computer",
      type: 'upgrade',
      count: 4
    }, {
      name: "TIE/x1",
      type: 'title',
      count: 4
    }, {
      name: "Cluster Missiles",
      type: 'upgrade',
      count: 1
    }, {
      name: "Proton Rockets",
      type: 'upgrade',
      count: 1
    }, {
      name: "Captain Needa",
      type: 'upgrade',
      count: 1
    }, {
      name: "Grand Moff Tarkin",
      type: 'upgrade',
      count: 1
    }, {
      name: "Emperor Palpatine",
      type: 'upgrade',
      count: 1
    }, {
      name: "Admiral Ozzel",
      type: 'upgrade',
      count: 1
    }, {
      name: "Shield Technician",
      type: 'upgrade',
      count: 2
    }, {
      name: "Gunnery Team",
      type: 'upgrade',
      count: 1
    }, {
      name: "Engineering Team",
      type: 'upgrade',
      count: 1
    }, {
      name: "Sensor Team",
      type: 'upgrade',
      count: 1
    }, {
      name: "Single Turbolasers",
      type: 'upgrade',
      count: 2
    }, {
      name: "Ion Cannon Battery",
      type: 'upgrade',
      count: 4
    }, {
      name: "Quad Laser Cannons",
      type: 'upgrade',
      count: 2
    }, {
      name: "Tibanna Gas Supplies",
      type: 'upgrade',
      count: 2
    }, {
      name: "Engine Booster",
      type: 'upgrade',
      count: 1
    }, {
      name: "Backup Shield Generator",
      type: 'upgrade',
      count: 1
    }, {
      name: "Comms Booster",
      type: 'upgrade',
      count: 1
    }, {
      name: "Assailer",
      type: 'title',
      count: 1
    }, {
      name: "Instigator",
      type: 'title',
      count: 1
    }, {
      name: "Impetuous",
      type: 'title',
      count: 1
    }
  ],
  'The Force Awakens Core Set': [
    {
      name: 'T-70 X-Wing',
      type: 'ship',
      count: 1
    }, {
      name: 'TIE/fo Fighter',
      type: 'ship',
      count: 2
    }, {
      name: 'Poe Dameron',
      type: 'pilot',
      count: 1
    }, {
      name: '"Blue Ace"',
      type: 'pilot',
      count: 1
    }, {
      name: '"Blue Ace"',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Red Squadron Veteran',
      type: 'pilot',
      count: 1
    }, {
      name: 'Blue Squadron Novice',
      type: 'pilot',
      count: 1
    }, {
      name: '"Omega Ace"',
      type: 'pilot',
      count: 1
    }, {
      name: '"Epsilon Leader"',
      type: 'pilot',
      count: 1
    }, {
      name: '"Zeta Ace"',
      type: 'pilot',
      count: 1
    }, {
      name: '"Omega Ace"',
      type: 'upgrade',
      count: 1
    }, {
      name: '"Epsilon Leader"',
      type: 'upgrade',
      count: 1
    }, {
      name: '"Zeta Ace"',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Omega Squadron Pilot',
      type: 'pilot',
      count: 2
    }, {
      name: 'Zeta Squadron Pilot',
      type: 'pilot',
      count: 2
    }, {
      name: 'Epsilon Squadron Pilot',
      type: 'pilot',
      count: 2
    }, {
      name: 'Wired',
      type: 'upgrade',
      count: 1
    }, {
      name: 'BB-8',
      type: 'upgrade',
      count: 1
    }, {
      name: 'R5-X3',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Proton Torpedoes',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Weapons Guidance',
      type: 'upgrade',
      count: 1
    }
  ],
  'Imperial Assault Carrier Expansion Pack': [
    {
      name: 'TIE Fighter',
      type: 'ship',
      count: 2
    }, {
      name: 'Gozanti-class Cruiser',
      type: 'ship',
      count: 1
    }, {
      name: 'Gozanti-class Cruiser',
      type: 'pilot',
      count: 1
    }, {
      name: '"Scourge"',
      type: 'pilot',
      count: 1
    }, {
      name: '"Wampa"',
      type: 'pilot',
      count: 1
    }, {
      name: '"Youngster"',
      type: 'pilot',
      count: 1
    }, {
      name: '"Chaser"',
      type: 'pilot',
      count: 1
    }, {
      name: '"Scourge"',
      type: 'upgrade',
      count: 1
    }, {
      name: '"Wampa"',
      type: 'upgrade',
      count: 1
    }, {
      name: '"Youngster"',
      type: 'upgrade',
      count: 1
    }, {
      name: '"Chaser"',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Academy Pilot',
      type: 'pilot',
      count: 2
    }, {
      name: 'Black Squadron Pilot',
      type: 'pilot',
      count: 2
    }, {
      name: 'Obsidian Squadron Pilot',
      type: 'pilot',
      count: 2
    }, {
      name: 'Marksmanship',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Expert Handling',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Expose',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Ion Torpedoes',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Cluster Missiles',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Homing Missiles',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Dual Laser Turret',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Broadcast Array',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Construction Droid',
      type: 'upgrade',
      count: 2
    }, {
      name: 'Agent Kallus',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Rear Admiral Chiraneau',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Ordnance Experts',
      type: 'upgrade',
      count: 2
    }, {
      name: 'Docking Clamps',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Cluster Bombs',
      type: 'upgrade',
      count: 2
    }, {
      name: 'Automated Protocols',
      type: 'modification',
      count: 3
    }, {
      name: 'Optimized Generators',
      type: 'modification',
      count: 3
    }, {
      name: 'Ordnance Tubes',
      type: 'modification',
      count: 2
    }, {
      name: 'Requiem',
      type: 'title',
      count: 1
    }, {
      name: 'Vector',
      type: 'title',
      count: 1
    }, {
      name: 'Suppressor',
      type: 'title',
      count: 1
    }
  ],
  'T-70 X-Wing Expansion Pack': [
    {
      name: 'T-70 X-Wing',
      type: 'ship',
      count: 1
    }, {
      name: 'Ello Asty',
      type: 'pilot',
      count: 1
    }, {
      name: '"Red Ace"',
      type: 'pilot',
      count: 1
    }, {
      name: 'Ello Asty',
      type: 'upgrade',
      count: 1
    }, {
      name: '"Red Ace"',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Red Squadron Veteran',
      type: 'pilot',
      count: 1
    }, {
      name: 'Blue Squadron Novice',
      type: 'pilot',
      count: 1
    }, {
      name: 'Cool Hand',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Targeting Astromech',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Weapons Guidance',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Integrated Astromech',
      type: 'modification',
      count: 1
    }, {
      name: 'Advanced Proton Torpedoes',
      type: 'upgrade',
      count: 1
    }
  ],
  'TIE/fo Fighter Expansion Pack': [
    {
      name: 'TIE/fo Fighter',
      type: 'ship',
      count: 1
    }, {
      name: '"Omega Leader"',
      type: 'pilot',
      count: 1
    }, {
      name: '"Zeta Leader"',
      type: 'pilot',
      count: 1
    }, {
      name: '"Epsilon Ace"',
      type: 'pilot',
      count: 1
    }, {
      name: '"Omega Leader"',
      type: 'upgrade',
      count: 1
    }, {
      name: '"Zeta Leader"',
      type: 'upgrade',
      count: 1
    }, {
      name: '"Epsilon Ace"',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Omega Squadron Pilot',
      type: 'pilot',
      count: 1
    }, {
      name: 'Zeta Squadron Pilot',
      type: 'pilot',
      count: 1
    }, {
      name: 'Epsilon Squadron Pilot',
      type: 'pilot',
      count: 1
    }, {
      name: 'Juke',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Comm Relay',
      type: 'upgrade',
      count: 1
    }
  ],
  'Ghost Expansion Pack': [
    {
      name: 'VCX-100',
      type: 'ship',
      count: 1
    }, {
      name: 'Attack Shuttle',
      type: 'ship',
      count: 1
    }, {
      name: 'Hera Syndulla',
      type: 'pilot',
      count: 1
    }, {
      name: 'Kanan Jarrus',
      type: 'pilot',
      count: 1
    }, {
      name: '"Chopper"',
      type: 'pilot',
      count: 1
    }, {
      name: 'Hera Syndulla.',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Kanan Jarrus.',
      type: 'upgrade',
      count: 1
    }, {
      name: '"Chopper".',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Lothal Rebel',
      type: 'pilot',
      count: 1
    }, {
      name: 'Hera Syndulla (Attack Shuttle)',
      type: 'pilot',
      count: 1
    }, {
      name: 'Sabine Wren',
      type: 'pilot',
      count: 1
    }, {
      name: 'Ezra Bridger',
      type: 'pilot',
      count: 1
    }, {
      name: '"Zeb" Orrelios',
      type: 'pilot',
      count: 1
    }, {
      name: 'Sabine Wren.',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Ezra Bridger.',
      type: 'upgrade',
      count: 1
    }, {
      name: '"Zeb" Orrelios.',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Predator',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Reinforced Deflectors',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Dorsal Turret',
      type: 'upgrade',
      count: 2
    }, {
      name: 'Advanced Proton Torpedoes',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Hera Syndulla',
      type: 'upgrade',
      count: 1
    }, {
      name: '"Zeb" Orrelios',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Kanan Jarrus',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Ezra Bridger',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Sabine Wren',
      type: 'upgrade',
      count: 1
    }, {
      name: '"Chopper"',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Conner Net',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Cluster Mines',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Thermal Detonators',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Ghost',
      type: 'title',
      count: 1
    }, {
      name: 'Phantom',
      type: 'title',
      count: 1
    }
  ],
  'Punishing One Expansion Pack': [
    {
      name: 'JumpMaster 5000',
      type: 'ship',
      count: 1
    }, {
      name: 'Dengar',
      type: 'pilot',
      count: 1
    }, {
      name: 'Tel Trevura',
      type: 'pilot',
      count: 1
    }, {
      name: 'Manaroo',
      type: 'pilot',
      count: 1
    }, {
      name: 'Dengar.',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Tel Trevura',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Manaroo',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Contracted Scout',
      type: 'pilot',
      count: 1
    }, {
      name: 'Rage',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Attanni Mindlink',
      type: 'upgrade',
      count: 2
    }, {
      name: 'Plasma Torpedoes',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Dengar',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Boba Fett',
      type: 'upgrade',
      count: 1
    }, {
      name: '"Gonk"',
      type: 'upgrade',
      count: 1
    }, {
      name: 'R5-P8',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Overclocked R4',
      type: 'upgrade',
      count: 2
    }, {
      name: 'Feedback Array',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Punishing One',
      type: 'title',
      count: 1
    }, {
      name: 'Guidance Chips',
      type: 'modification',
      count: 2
    }
  ],
  'Mist Hunter Expansion Pack': [
    {
      name: 'G-1A Starfighter',
      type: 'ship',
      count: 1
    }, {
      name: 'Zuckuss',
      type: 'pilot',
      count: 1
    }, {
      name: '4-LOM',
      type: 'pilot',
      count: 1
    }, {
      name: 'Zuckuss.',
      type: 'upgrade',
      count: 1
    }, {
      name: '4-LOM.',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Gand Findsman',
      type: 'pilot',
      count: 1
    }, {
      name: 'Ruthless Freelancer',
      type: 'pilot',
      count: 1
    }, {
      name: 'Adaptability',
      type: 'upgrade',
      count: 2
    }, {
      name: 'Tractor Beam',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Electronic Baffle',
      type: 'upgrade',
      count: 2
    }, {
      name: '4-LOM',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Zuckuss',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Cloaking Device',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Mist Hunter',
      type: 'title',
      count: 1
    }
  ],
  "Inquisitor's TIE Expansion Pack": [
    {
      name: 'TIE Advanced Prototype',
      type: 'ship',
      count: 1
    }, {
      name: 'The Inquisitor',
      type: 'pilot',
      count: 1
    }, {
      name: 'Valen Rudor',
      type: 'pilot',
      count: 1
    }, {
      name: 'The Inquisitor',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Valen Rudor',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Baron of the Empire',
      type: 'pilot',
      count: 1
    }, {
      name: 'Sienar Test Pilot',
      type: 'pilot',
      count: 1
    }, {
      name: 'Deadeye',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Homing Missiles',
      type: 'upgrade',
      count: 1
    }, {
      name: 'XX-23 S-Thread Tracers',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Guidance Chips',
      type: 'modification',
      count: 1
    }, {
      name: 'TIE/v1',
      type: 'title',
      count: 1
    }
  ],
  "Imperial Veterans Expansion Pack": [
    {
      name: 'TIE Bomber',
      type: 'ship',
      count: 1
    }, {
      name: 'TIE Defender',
      type: 'ship',
      count: 1
    }, {
      name: 'Tomax Bren',
      type: 'pilot',
      count: 1
    }, {
      name: '"Deathfire"',
      type: 'pilot',
      count: 1
    }, {
      name: 'Tomax Bren',
      type: 'upgrade',
      count: 1
    }, {
      name: '"Deathfire"',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Gamma Squadron Veteran',
      type: 'pilot',
      count: 2
    }, {
      name: 'Maarek Stele (TIE Defender)',
      type: 'pilot',
      count: 1
    }, {
      name: 'Countess Ryad',
      type: 'pilot',
      count: 1
    }, {
      name: 'Maarek Stele (TIE Defender)',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Countess Ryad',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Glaive Squadron Pilot',
      type: 'pilot',
      count: 2
    }, {
      name: 'Crack Shot',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Tractor Beam',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Systems Officer',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Cluster Mines',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Proximity Mines',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Long-Range Scanners',
      type: 'modification',
      count: 2
    }, {
      name: 'TIE/x7',
      type: 'title',
      count: 2
    }, {
      name: 'TIE/D',
      type: 'title',
      count: 2
    }, {
      name: 'TIE Shuttle',
      type: 'title',
      count: 2
    }
  ],
  'ARC-170 Expansion Pack': [
    {
      name: 'ARC-170',
      type: 'ship',
      count: 1
    }, {
      name: 'Norra Wexley',
      type: 'pilot',
      count: 1
    }, {
      name: 'Shara Bey',
      type: 'pilot',
      count: 1
    }, {
      name: 'Thane Kyrell',
      type: 'pilot',
      count: 1
    }, {
      name: 'Braylen Stramm',
      type: 'pilot',
      count: 1
    }, {
      name: 'Norra Wexley',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Shara Bey',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Thane Kyrell',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Braylen Stramm',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Adrenaline Rush',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Recon Specialist',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Tail Gunner',
      type: 'upgrade',
      count: 1
    }, {
      name: 'R3 Astromech',
      type: 'upgrade',
      count: 2
    }, {
      name: 'Seismic Torpedo',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Vectored Thrusters',
      type: 'modification',
      count: 2
    }, {
      name: 'Alliance Overhaul',
      type: 'title',
      count: 1
    }
  ],
  'Special Forces TIE Expansion Pack': [
    {
      name: 'TIE/sf Fighter',
      type: 'ship',
      count: 1
    }, {
      name: '"Quickdraw"',
      type: 'pilot',
      count: 1
    }, {
      name: '"Backdraft"',
      type: 'pilot',
      count: 1
    }, {
      name: '"Quickdraw"',
      type: 'upgrade',
      count: 1
    }, {
      name: '"Backdraft"',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Omega Specialist',
      type: 'pilot',
      count: 1
    }, {
      name: 'Zeta Specialist',
      type: 'pilot',
      count: 1
    }, {
      name: 'Wired',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Collision Detector',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Sensor Cluster',
      type: 'upgrade',
      count: 2
    }, {
      name: 'Special Ops Training',
      type: 'title',
      count: 1
    }
  ],
  'Protectorate Starfighter Expansion Pack': [
    {
      name: 'Protectorate Starfighter',
      type: 'ship',
      count: 1
    }, {
      name: 'Fenn Rau',
      type: 'pilot',
      count: 1
    }, {
      name: 'Old Teroch',
      type: 'pilot',
      count: 1
    }, {
      name: 'Kad Solus',
      type: 'pilot',
      count: 1
    }, {
      name: 'Fenn Rau',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Old Teroch',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Kad Solus',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Concord Dawn Ace',
      type: 'pilot',
      count: 1
    }, {
      name: 'Concord Dawn Veteran',
      type: 'pilot',
      count: 1
    }, {
      name: 'Zealous Recruit',
      type: 'pilot',
      count: 1
    }, {
      name: 'Fearlessness',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Concord Dawn Protector',
      type: 'title',
      count: 1
    }
  ],
  'Shadow Caster Expansion Pack': [
    {
      name: 'Lancer-class Pursuit Craft',
      type: 'ship',
      count: 1
    }, {
      name: 'Ketsu Onyo',
      type: 'pilot',
      count: 1
    }, {
      name: 'Asajj Ventress',
      type: 'pilot',
      count: 1
    }, {
      name: 'Sabine Wren (Scum)',
      type: 'pilot',
      count: 1
    }, {
      name: 'Ketsu Onyo.',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Asajj Ventress',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Sabine Wren (Scum)',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Shadowport Hunter',
      type: 'pilot',
      count: 1
    }, {
      name: 'Veteran Instincts',
      type: 'upgrade',
      count: 1
    }, {
      name: 'IG-88D',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Ketsu Onyo',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Latts Razzi',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Black Market Slicer Tools',
      type: 'upgrade',
      count: 2
    }, {
      name: 'Rigged Cargo Chute',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Countermeasures',
      type: 'modification',
      count: 1
    }, {
      name: 'Gyroscopic Targeting',
      type: 'modification',
      count: 1
    }, {
      name: 'Tactical Jammer',
      type: 'modification',
      count: 2
    }, {
      name: 'Shadow Caster',
      type: 'title',
      count: 1
    }
  ],
  'Heroes of the Resistance Expansion Pack': [
    {
      name: 'YT-1300',
      type: 'ship',
      count: 1
    }, {
      name: 'T-70 X-Wing',
      type: 'ship',
      count: 1
    }, {
      name: 'Han Solo (TFA)',
      type: 'pilot',
      count: 1
    }, {
      name: 'Rey',
      type: 'pilot',
      count: 1
    }, {
      name: 'Chewbacca (TFA)',
      type: 'pilot',
      count: 1
    }, {
      name: 'Han Solo (TFA)',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Rey.',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Chewbacca (TFA)',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Resistance Sympathizer',
      type: 'pilot',
      count: 1
    }, {
      name: 'Poe Dameron (PS9)',
      type: 'pilot',
      count: 1
    }, {
      name: 'Nien Nunb',
      type: 'pilot',
      count: 1
    }, {
      name: '"Snap" Wexley',
      type: 'pilot',
      count: 1
    }, {
      name: 'Jess Pava',
      type: 'pilot',
      count: 1
    }, {
      name: 'Poe Dameron (PS9)',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Nien Nunb',
      type: 'upgrade',
      count: 1
    }, {
      name: '"Snap" Wexley',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Jess Pava',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Red Squadron Veteran',
      type: 'pilot',
      count: 1
    }, {
      name: 'Blue Squadron Novice',
      type: 'pilot',
      count: 1
    }, {
      name: 'Snap Shot',
      type: 'upgrade',
      count: 2
    }, {
      name: 'Trick Shot',
      type: 'upgrade',
      count: 2
    }, {
      name: 'Finn',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Hotshot Co-pilot',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Rey',
      type: 'upgrade',
      count: 1
    }, {
      name: 'M9-G8',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Burnout SLAM',
      type: 'upgrade',
      count: 2
    }, {
      name: 'Primed Thrusters',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Pattern Analyzer',
      type: 'upgrade',
      count: 2
    }, {
      name: 'Millennium Falcon (TFA)',
      type: 'title',
      count: 1
    }, {
      name: 'Black One',
      type: 'title',
      count: 1
    }, {
      name: 'Integrated Astromech',
      type: 'modification',
      count: 2
    }, {
      name: 'Smuggling Compartment',
      type: 'modification',
      count: 1
    }
  ],
  "U-Wing Expansion Pack": [
    {
      name: 'U-Wing',
      type: 'ship',
      count: 1
    }, {
      name: 'Cassian Andor',
      type: 'pilot',
      count: 1
    }, {
      name: 'Bodhi Rook',
      type: 'pilot',
      count: 1
    }, {
      name: 'Heff Tobber',
      type: 'pilot',
      count: 1
    }, {
      name: 'Cassian Andor.',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Bodhi Rook.',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Heff Tobber',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Blue Squadron Pathfinder',
      type: 'pilot',
      count: 1
    }, {
      name: 'Inspiring Recruit',
      type: 'upgrade',
      count: 2
    }, {
      name: 'Cassian Andor',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Bistan',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Jyn Erso',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Baze Malbus',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Bodhi Rook',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Expertise',
      type: 'upgrade',
      count: 2
    }, {
      name: 'Pivot Wing',
      type: 'title',
      count: 1
    }, {
      name: 'Stealth Device',
      type: 'modification',
      count: 2
    }, {
      name: 'Sensor Jammer',
      type: 'upgrade',
      count: 1
    }
  ],
  "TIE Striker Expansion Pack": [
    {
      name: 'TIE Striker',
      type: 'ship',
      count: 1
    }, {
      name: '"Duchess"',
      type: 'pilot',
      count: 1
    }, {
      name: '"Pure Sabacc"',
      type: 'pilot',
      count: 1
    }, {
      name: '"Countdown"',
      type: 'pilot',
      count: 1
    }, {
      name: '"Duchess"',
      type: 'upgrade',
      count: 1
    }, {
      name: '"Pure Sabacc"',
      type: 'upgrade',
      count: 1
    }, {
      name: '"Countdown"',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Black Squadron Scout',
      type: 'pilot',
      count: 1
    }, {
      name: 'Scarif Defender',
      type: 'pilot',
      count: 1
    }, {
      name: 'Imperial Trainee',
      type: 'pilot',
      count: 1
    }, {
      name: 'Swarm Leader',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Lightweight Frame',
      type: 'modification',
      count: 1
    }, {
      name: 'Adaptive Ailerons',
      type: 'title',
      count: 1
    }
  ],
  "Sabine's TIE Fighter Expansion Pack": [
    {
      name: 'TIE Fighter',
      type: 'ship',
      count: 1
    }, {
      name: 'Ahsoka Tano',
      type: 'pilot',
      count: 1
    }, {
      name: 'Sabine Wren (TIE Fighter)',
      type: 'pilot',
      count: 1
    }, {
      name: 'Captain Rex',
      type: 'pilot',
      count: 1
    }, {
      name: 'Ahsoka Tano',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Captain Rex.',
      type: 'upgrade',
      count: 1
    }, {
      name: '"Zeb" Orrelios (TIE Fighter)',
      type: 'pilot',
      count: 1
    }, {
      name: 'Veteran Instincts',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Captain Rex',
      type: 'upgrade',
      count: 1
    }, {
      name: 'EMP Device',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Sabine\'s Masterpiece',
      type: 'title',
      count: 1
    }, {
      name: 'Captured TIE',
      type: 'modification',
      count: 1
    }
  ],
  "Upsilon-class Shuttle Expansion Pack": [
    {
      name: 'Upsilon-class Shuttle',
      type: 'ship',
      count: 1
    }, {
      name: 'Kylo Ren',
      type: 'pilot',
      count: 1
    }, {
      name: 'Major Stridan',
      type: 'pilot',
      count: 1
    }, {
      name: 'Lieutenant Dormitz',
      type: 'pilot',
      count: 1
    }, {
      name: 'Kylo Ren.',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Major Stridan',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Lieutenant Dormitz',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Starkiller Base Pilot',
      type: 'pilot',
      count: 1
    }, {
      name: 'Snap Shot',
      type: 'upgrade',
      count: 2
    }, {
      name: 'Kylo Ren',
      type: 'upgrade',
      count: 1
    }, {
      name: 'General Hux',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Operations Specialist',
      type: 'upgrade',
      count: 2
    }, {
      name: 'Targeting Synchronizer',
      type: 'upgrade',
      count: 2
    }, {
      name: 'Hyperwave Comm Scanner',
      type: 'upgrade',
      count: 2
    }, {
      name: 'Ion Projector',
      type: 'modification',
      count: 2
    }, {
      name: 'Kylo Ren\'s Shuttle',
      type: 'title',
      count: 1
    }
  ],
  "Quadjumper Expansion Pack": [
    {
      name: 'Quadjumper',
      type: 'ship',
      count: 1
    }, {
      name: 'Constable Zuvio',
      type: 'pilot',
      count: 1
    }, {
      name: 'Sarco Plank',
      type: 'pilot',
      count: 1
    }, {
      name: 'Unkar Plutt',
      type: 'pilot',
      count: 1
    }, {
      name: 'Constable Zuvio',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Sarco Plank',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Unkar Plutt.',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Jakku Gunrunner',
      type: 'pilot',
      count: 1
    }, {
      name: 'A Score to Settle',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Unkar Plutt',
      type: 'upgrade',
      count: 1
    }, {
      name: 'BoShek',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Thermal Detonators',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Hyperwave Comm Scanner',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Scavenger Crane',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Spacetug Tractor Array',
      type: 'modification',
      count: 1
    }
  ],
  'C-ROC Cruiser Expansion Pack': [
    {
      name: 'C-ROC Cruiser',
      type: 'ship',
      count: 1
    }, {
      name: 'M3-A Interceptor',
      type: 'ship',
      count: 1
    }, {
      name: 'C-ROC Cruiser',
      type: 'pilot',
      count: 1
    }, {
      name: 'Genesis Red',
      type: 'pilot',
      count: 1
    }, {
      name: 'Quinn Jast',
      type: 'pilot',
      count: 1
    }, {
      name: 'Inaldra',
      type: 'pilot',
      count: 1
    }, {
      name: 'Sunny Bounder',
      type: 'pilot',
      count: 1
    }, {
      name: 'Genesis Red',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Quinn Jast',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Inaldra',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Sunny Bounder',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Tansarii Point Veteran',
      type: 'pilot',
      count: 1
    }, {
      name: 'Cartel Spacer',
      type: 'pilot',
      count: 1
    }, {
      name: 'Azmorigan',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Cikatro Vizago',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Jabba the Hutt',
      type: 'upgrade',
      count: 1
    }, {
      name: 'IG-RM Thug Droids',
      type: 'upgrade',
      count: 1
    }, {
      name: 'ARC Caster',
      type: 'upgrade',
      count: 5
    }, {
      name: 'Heavy Laser Turret',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Supercharged Power Cells',
      type: 'upgrade',
      count: 2
    }, {
      name: 'Quick-release Cargo Locks',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Merchant One',
      type: 'title',
      count: 1
    }, {
      name: 'Broken Horn',
      type: 'title',
      count: 1
    }, {
      name: 'Insatiable Worrt',
      type: 'title',
      count: 1
    }, {
      name: '"Light Scyk" Interceptor',
      type: 'title',
      count: 6
    }, {
      name: 'Automated Protocols',
      type: 'modification',
      count: 1
    }, {
      name: 'Optimized Generators',
      type: 'modification',
      count: 1
    }, {
      name: 'Pulsed Ray Shield',
      type: 'modification',
      count: 5
    }
  ],
  "Auzituck Gunship Expansion Pack": [
    {
      name: 'Auzituck Gunship',
      type: 'ship',
      count: 1
    }, {
      name: 'Wullffwarro',
      type: 'pilot',
      count: 1
    }, {
      name: 'Lowhhrick',
      type: 'pilot',
      count: 1
    }, {
      name: 'Wullffwarro',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Lowhhrick',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Wookiee Liberator',
      type: 'pilot',
      count: 1
    }, {
      name: 'Kashyyyk Defender',
      type: 'pilot',
      count: 1
    }, {
      name: 'Intimidation',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Selflessness',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Wookiee Commandos',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Tactician',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Breach Specialist',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Hull Upgrade',
      type: 'modification',
      count: 1
    }
  ],
  "Scurrg H-6 Bomber Expansion Pack": [
    {
      name: 'Scurrg H-6 Bomber',
      type: 'ship',
      count: 1
    }, {
      name: 'Captain Nym (Rebel)',
      type: 'pilot',
      count: 1
    }, {
      name: 'Captain Nym (Scum)',
      type: 'pilot',
      count: 1
    }, {
      name: 'Sol Sixxa',
      type: 'pilot',
      count: 1
    }, {
      name: 'Captain Nym (Rebel)',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Captain Nym (Scum)',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Sol Sixxa',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Lok Revenant',
      type: 'pilot',
      count: 1
    }, {
      name: 'Karthakk Pirate',
      type: 'pilot',
      count: 1
    }, {
      name: 'Lightning Reflexes',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Seismic Torpedo',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Cruise Missiles',
      type: 'upgrade',
      count: 2
    }, {
      name: 'Bomblet Generator',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Minefield Mapper',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Synced Turret',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Cad Bane',
      type: 'upgrade',
      count: 1
    }, {
      name: 'R4-E1',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Havoc',
      type: 'title',
      count: 1
    }
  ],
  "TIE Aggressor Expansion Pack": [
    {
      name: 'TIE Aggressor',
      type: 'ship',
      count: 1
    }, {
      name: 'Lieutenant Kestal',
      type: 'pilot',
      count: 1
    }, {
      name: '"Double Edge"',
      type: 'pilot',
      count: 1
    }, {
      name: 'Lieutenant Kestal',
      type: 'upgrade',
      count: 1
    }, {
      name: '"Double Edge"',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Onyx Squadron Escort',
      type: 'pilot',
      count: 1
    }, {
      name: 'Sienar Specialist',
      type: 'pilot',
      count: 1
    }, {
      name: 'Intensity',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Unguided Rockets',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Twin Laser Turret',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Synced Turret',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Lightweight Frame',
      type: 'modification',
      count: 1
    }
  ],
  'Guns for Hire Expansion Pack': [
    {
      name: 'Kihraxz Fighter',
      type: 'ship',
      count: 1
    }, {
      name: 'StarViper',
      type: 'ship',
      count: 1
    }, {
      name: 'Viktor Hel',
      type: 'pilot',
      count: 1
    }, {
      name: 'Captain Jostero',
      type: 'pilot',
      count: 1
    }, {
      name: 'Viktor Hel',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Captain Jostero',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Black Sun Ace',
      type: 'pilot',
      count: 1
    }, {
      name: 'Cartel Marauder',
      type: 'pilot',
      count: 1
    }, {
      name: 'Dalan Oberos',
      type: 'pilot',
      count: 1
    }, {
      name: 'Thweek',
      type: 'pilot',
      count: 1
    }, {
      name: 'Dalan Oberos',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Thweek',
      type: 'upgrade',
      count: 1
    }, {
      name: 'Black Sun Assassin',
      type: 'pilot',
      count: 2
    }, {
      name: 'Harpoon Missiles',
      type: 'upgrade',
      count: 2
    }, {
      name: 'Ion Dischargers',
      type: 'upgrade',
      count: 2
    }, {
      name: 'StarViper Mk. II',
      type: 'title',
      count: 2
    }, {
      name: 'Vaksai',
      type: 'title',
      count: 2
    }, {
      name: 'Pulsed Ray Shield',
      type: 'modification',
      count: 2
    }, {
      name: 'Stealth Device',
      type: 'modification',
      count: 1
    }, {
      name: 'Vectored Thrusters',
      type: 'modification',
      count: 1
    }
  ]
};

exportObj.Collection = (function() {
  function Collection(args) {
    this.onLanguageChange = __bind(this.onLanguageChange, this);
    var _ref, _ref1;
    this.expansions = (_ref = args.expansions) != null ? _ref : {};
    this.singletons = (_ref1 = args.singletons) != null ? _ref1 : {};
    this.backend = args.backend;
    this.setupUI();
    this.setupHandlers();
    this.reset();
    this.language = 'English';
  }

  Collection.prototype.reset = function() {
    var card, component_content, contents, count, counts, expansion, name, thing, things, type, ul, _, _base1, _base2, _base3, _base4, _base5, _base6, _i, _j, _k, _l, _len, _name, _name1, _ref, _ref1, _ref2, _ref3, _ref4, _ref5, _ref6, _ref7, _results;
    this.shelf = {};
    this.table = {};
    _ref = this.expansions;
    for (expansion in _ref) {
      count = _ref[expansion];
      try {
        count = parseInt(count);
      } catch (_error) {
        count = 0;
      }
      for (_ = _i = 0; 0 <= count ? _i < count : _i > count; _ = 0 <= count ? ++_i : --_i) {
        _ref2 = (_ref1 = exportObj.manifestByExpansion[expansion]) != null ? _ref1 : [];
        for (_j = 0, _len = _ref2.length; _j < _len; _j++) {
          card = _ref2[_j];
          for (_ = _k = 0, _ref3 = card.count; 0 <= _ref3 ? _k < _ref3 : _k > _ref3; _ = 0 <= _ref3 ? ++_k : --_k) {
            ((_base1 = ((_base2 = this.shelf)[_name1 = card.type] != null ? _base2[_name1] : _base2[_name1] = {}))[_name = card.name] != null ? _base1[_name] : _base1[_name] = []).push(expansion);
          }
        }
      }
    }
    _ref4 = this.singletons;
    for (type in _ref4) {
      counts = _ref4[type];
      for (name in counts) {
        count = counts[name];
        for (_ = _l = 0; 0 <= count ? _l < count : _l > count; _ = 0 <= count ? ++_l : --_l) {
          ((_base3 = ((_base4 = this.shelf)[type] != null ? _base4[type] : _base4[type] = {}))[name] != null ? _base3[name] : _base3[name] = []).push('singleton');
        }
      }
    }
    this.counts = {};
    _ref5 = this.shelf;
    for (type in _ref5) {
      if (!__hasProp.call(_ref5, type)) continue;
      _ref6 = this.shelf[type];
      for (thing in _ref6) {
        if (!__hasProp.call(_ref6, thing)) continue;
        if ((_base5 = ((_base6 = this.counts)[type] != null ? _base6[type] : _base6[type] = {}))[thing] == null) {
          _base5[thing] = 0;
        }
        this.counts[type][thing] += this.shelf[type][thing].length;
      }
    }
    component_content = $(this.modal.find('.collection-inventory-content'));
    component_content.text('');
    _ref7 = this.counts;
    _results = [];
    for (type in _ref7) {
      if (!__hasProp.call(_ref7, type)) continue;
      things = _ref7[type];
      contents = component_content.append($.trim("<div class=\"row-fluid\">\n    <div class=\"span12\"><h5>" + (type.capitalize()) + "</h5></div>\n</div>\n<div class=\"row-fluid\">\n    <ul id=\"counts-" + type + "\" class=\"span12\"></ul>\n</div>"));
      ul = $(contents.find("ul#counts-" + type));
      _results.push((function() {
        var _len1, _m, _ref8, _results1;
        _ref8 = Object.keys(things).sort(sortWithoutQuotes);
        _results1 = [];
        for (_m = 0, _len1 = _ref8.length; _m < _len1; _m++) {
          thing = _ref8[_m];
          _results1.push(ul.append("<li>" + thing + " - " + things[thing] + "</li>"));
        }
        return _results1;
      })());
    }
    return _results;
  };

  Collection.prototype.fixName = function(name) {
    if (name.indexOf('"Heavy Scyk" Interceptor') === 0) {
      return '"Heavy Scyk" Interceptor';
    } else {
      return name;
    }
  };

  Collection.prototype.check = function(where, type, name) {
    var _ref, _ref1, _ref2;
    return ((_ref = ((_ref1 = ((_ref2 = where[type]) != null ? _ref2 : {})[this.fixName(name)]) != null ? _ref1 : []).length) != null ? _ref : 0) !== 0;
  };

  Collection.prototype.checkShelf = function(type, name) {
    return this.check(this.shelf, type, name);
  };

  Collection.prototype.checkTable = function(type, name) {
    return this.check(this.table, type, name);
  };

  Collection.prototype.use = function(type, name) {
    var card, e, _base1, _base2;
    name = this.fixName(name);
    try {
      card = this.shelf[type][name].pop();
    } catch (_error) {
      e = _error;
      if (card == null) {
        return false;
      }
    }
    if (card != null) {
      ((_base1 = ((_base2 = this.table)[type] != null ? _base2[type] : _base2[type] = {}))[name] != null ? _base1[name] : _base1[name] = []).push(card);
      return true;
    } else {
      return false;
    }
  };

  Collection.prototype.release = function(type, name) {
    var card, e, _base1, _base2;
    name = this.fixName(name);
    try {
      card = this.table[type][name].pop();
    } catch (_error) {
      e = _error;
      if (card == null) {
        return false;
      }
    }
    if (card != null) {
      ((_base1 = ((_base2 = this.shelf)[type] != null ? _base2[type] : _base2[type] = {}))[name] != null ? _base1[name] : _base1[name] = []).push(card);
      return true;
    } else {
      return false;
    }
  };

  Collection.prototype.save = function(cb) {
    if (cb == null) {
      cb = $.noop;
    }
    if (this.backend != null) {
      return this.backend.saveCollection(this, cb);
    }
  };

  Collection.load = function(backend, cb) {
    return backend.loadCollection(cb);
  };

  Collection.prototype.setupUI = function() {
    var collection_content, count, expansion, expname, input, item, items, modification, modificationcollection_content, name, names, pilot, pilotcollection_content, row, ship, shipcollection_content, singletonsByType, sorted_names, title, titlecollection_content, type, upgrade, upgradecollection_content, _i, _j, _k, _l, _len, _len1, _len2, _len3, _len4, _len5, _len6, _m, _n, _name, _o, _ref, _ref1, _ref10, _ref11, _ref12, _ref13, _ref14, _ref15, _ref16, _ref17, _ref2, _ref3, _ref4, _ref5, _ref6, _ref7, _ref8, _ref9, _results;
    singletonsByType = {};
    _ref = exportObj.manifestByExpansion;
    for (expname in _ref) {
      items = _ref[expname];
      for (_i = 0, _len = items.length; _i < _len; _i++) {
        item = items[_i];
        (singletonsByType[_name = item.type] != null ? singletonsByType[_name] : singletonsByType[_name] = {})[item.name] = true;
      }
    }
    for (type in singletonsByType) {
      names = singletonsByType[type];
      sorted_names = ((function() {
        var _results;
        _results = [];
        for (name in names) {
          _results.push(name);
        }
        return _results;
      })()).sort(sortWithoutQuotes);
      singletonsByType[type] = sorted_names;
    }
    this.modal = $(document.createElement('DIV'));
    this.modal.addClass('modal hide fade collection-modal hidden-print');
    $('body').append(this.modal);
    this.modal.append($.trim("<div class=\"modal-header\">\n    <button type=\"button\" class=\"close hidden-print\" data-dismiss=\"modal\" aria-hidden=\"true\">&times;</button>\n    <h4>Your Collection</h4>\n</div>\n<div class=\"modal-body\">\n    <ul class=\"nav nav-tabs\">\n        <li class=\"active\"><a data-target=\"#collection-expansions\" data-toggle=\"tab\">Expansions</a><li>\n        <li><a data-target=\"#collection-ships\" data-toggle=\"tab\">Ships</a><li>\n        <li><a data-target=\"#collection-pilots\" data-toggle=\"tab\">Pilots</a><li>\n        <li><a data-target=\"#collection-upgrades\" data-toggle=\"tab\">Upgrades</a><li>\n        <li><a data-target=\"#collection-modifications\" data-toggle=\"tab\">Mods</a><li>\n        <li><a data-target=\"#collection-titles\" data-toggle=\"tab\">Titles</a><li>\n        <li><a data-target=\"#collection-components\" data-toggle=\"tab\">Inventory</a><li>\n    </ul>\n    <div class=\"tab-content\">\n        <div id=\"collection-expansions\" class=\"tab-pane active container-fluid collection-content\"></div>\n        <div id=\"collection-ships\" class=\"tab-pane active container-fluid collection-ship-content\"></div>\n        <div id=\"collection-pilots\" class=\"tab-pane active container-fluid collection-pilot-content\"></div>\n        <div id=\"collection-upgrades\" class=\"tab-pane active container-fluid collection-upgrade-content\"></div>\n        <div id=\"collection-modifications\" class=\"tab-pane active container-fluid collection-modification-content\"></div>\n        <div id=\"collection-titles\" class=\"tab-pane active container-fluid collection-title-content\"></div>\n        <div id=\"collection-components\" class=\"tab-pane container-fluid collection-inventory-content\"></div>\n    </div>\n</div>\n<div class=\"modal-footer hidden-print\">\n    <span class=\"collection-status\"></span>\n    &nbsp;\n    <button class=\"btn\" data-dismiss=\"modal\" aria-hidden=\"true\">Close</button>\n</div>"));
    this.modal_status = $(this.modal.find('.collection-status'));
    collection_content = $(this.modal.find('.collection-content'));
    _ref1 = exportObj.expansions;
    for (_j = 0, _len1 = _ref1.length; _j < _len1; _j++) {
      expansion = _ref1[_j];
      count = parseInt((_ref2 = this.expansions[expansion]) != null ? _ref2 : 0);
      row = $.parseHTML($.trim("<div class=\"row-fluid\">\n    <div class=\"span12\">\n        <label>\n            <input class=\"expansion-count\" type=\"number\" size=\"3\" value=\"" + count + "\" />\n            <span class=\"expansion-name\">" + expansion + "</span>\n        </label>\n    </div>\n</div>"));
      input = $($(row).find('input'));
      input.data('expansion', expansion);
      input.closest('div').css('background-color', this.countToBackgroundColor(input.val()));
      $(row).find('.expansion-name').data('english_name', expansion);
      collection_content.append(row);
    }
    shipcollection_content = $(this.modal.find('.collection-ship-content'));
    _ref3 = singletonsByType.ship;
    for (_k = 0, _len2 = _ref3.length; _k < _len2; _k++) {
      ship = _ref3[_k];
      count = parseInt((_ref4 = (_ref5 = this.singletons.ship) != null ? _ref5[ship] : void 0) != null ? _ref4 : 0);
      row = $.parseHTML($.trim("<div class=\"row-fluid\">\n    <div class=\"span12\">\n        <label>\n            <input class=\"singleton-count\" type=\"number\" size=\"3\" value=\"" + count + "\" />\n            <span class=\"ship-name\">" + ship + "</span>\n        </label>\n    </div>\n</div>"));
      input = $($(row).find('input'));
      input.data('singletonType', 'ship');
      input.data('singletonName', ship);
      input.closest('div').css('background-color', this.countToBackgroundColor(input.val()));
      $(row).find('.ship-name').data('english_name', expansion);
      shipcollection_content.append(row);
    }
    pilotcollection_content = $(this.modal.find('.collection-pilot-content'));
    _ref6 = singletonsByType.pilot;
    for (_l = 0, _len3 = _ref6.length; _l < _len3; _l++) {
      pilot = _ref6[_l];
      count = parseInt((_ref7 = (_ref8 = this.singletons.pilot) != null ? _ref8[pilot] : void 0) != null ? _ref7 : 0);
      row = $.parseHTML($.trim("<div class=\"row-fluid\">\n    <div class=\"span12\">\n        <label>\n            <input class=\"singleton-count\" type=\"number\" size=\"3\" value=\"" + count + "\" />\n            <span class=\"pilot-name\">" + pilot + "</span>\n        </label>\n    </div>\n</div>"));
      input = $($(row).find('input'));
      input.data('singletonType', 'pilot');
      input.data('singletonName', pilot);
      input.closest('div').css('background-color', this.countToBackgroundColor(input.val()));
      $(row).find('.pilot-name').data('english_name', expansion);
      pilotcollection_content.append(row);
    }
    upgradecollection_content = $(this.modal.find('.collection-upgrade-content'));
    _ref9 = singletonsByType.upgrade;
    for (_m = 0, _len4 = _ref9.length; _m < _len4; _m++) {
      upgrade = _ref9[_m];
      count = parseInt((_ref10 = (_ref11 = this.singletons.upgrade) != null ? _ref11[upgrade] : void 0) != null ? _ref10 : 0);
      row = $.parseHTML($.trim("<div class=\"row-fluid\">\n    <div class=\"span12\">\n        <label>\n            <input class=\"singleton-count\" type=\"number\" size=\"3\" value=\"" + count + "\" />\n            <span class=\"upgrade-name\">" + upgrade + "</span>\n        </label>\n    </div>\n</div>"));
      input = $($(row).find('input'));
      input.data('singletonType', 'upgrade');
      input.data('singletonName', upgrade);
      input.closest('div').css('background-color', this.countToBackgroundColor(input.val()));
      $(row).find('.upgrade-name').data('english_name', expansion);
      upgradecollection_content.append(row);
    }
    modificationcollection_content = $(this.modal.find('.collection-modification-content'));
    _ref12 = singletonsByType.modification;
    for (_n = 0, _len5 = _ref12.length; _n < _len5; _n++) {
      modification = _ref12[_n];
      count = parseInt((_ref13 = (_ref14 = this.singletons.modification) != null ? _ref14[modification] : void 0) != null ? _ref13 : 0);
      row = $.parseHTML($.trim("<div class=\"row-fluid\">\n    <div class=\"span12\">\n        <label>\n            <input class=\"singleton-count\" type=\"number\" size=\"3\" value=\"" + count + "\" />\n            <span class=\"modification-name\">" + modification + "</span>\n        </label>\n    </div>\n</div>"));
      input = $($(row).find('input'));
      input.data('singletonType', 'modification');
      input.data('singletonName', modification);
      input.closest('div').css('background-color', this.countToBackgroundColor(input.val()));
      $(row).find('.modification-name').data('english_name', expansion);
      modificationcollection_content.append(row);
    }
    titlecollection_content = $(this.modal.find('.collection-title-content'));
    _ref15 = singletonsByType.title;
    _results = [];
    for (_o = 0, _len6 = _ref15.length; _o < _len6; _o++) {
      title = _ref15[_o];
      count = parseInt((_ref16 = (_ref17 = this.singletons.title) != null ? _ref17[title] : void 0) != null ? _ref16 : 0);
      row = $.parseHTML($.trim("<div class=\"row-fluid\">\n    <div class=\"span12\">\n        <label>\n            <input class=\"singleton-count\" type=\"number\" size=\"3\" value=\"" + count + "\" />\n            <span class=\"title-name\">" + title + "</span>\n        </label>\n    </div>\n</div>"));
      input = $($(row).find('input'));
      input.data('singletonType', 'title');
      input.data('singletonName', title);
      input.closest('div').css('background-color', this.countToBackgroundColor(input.val()));
      $(row).find('.title-name').data('english_name', expansion);
      _results.push(titlecollection_content.append(row));
    }
    return _results;
  };

  Collection.prototype.destroyUI = function() {
    this.modal.modal('hide');
    this.modal.remove();
    return $(exportObj).trigger('xwing-collection:destroyed', this);
  };

  Collection.prototype.setupHandlers = function() {
    $(exportObj).trigger('xwing-collection:created', this);
    $(exportObj).on('xwing-backend:authenticationChanged', (function(_this) {
      return function(e, authenticated, backend) {
        if (!authenticated) {
          return _this.destroyUI();
        }
      };
    })(this)).on('xwing-collection:saved', (function(_this) {
      return function(e, collection) {
        _this.modal_status.text('Collection saved');
        return _this.modal_status.fadeIn(100, function() {
          return _this.modal_status.fadeOut(5000);
        });
      };
    })(this)).on('xwing:languageChanged', this.onLanguageChange);
    $(this.modal.find('input.expansion-count').change((function(_this) {
      return function(e) {
        var target, val;
        target = $(e.target);
        val = target.val();
        if (val < 0 || isNaN(parseInt(val))) {
          target.val(0);
        }
        _this.expansions[target.data('expansion')] = parseInt(target.val());
        target.closest('div').css('background-color', _this.countToBackgroundColor(val));
        return $(exportObj).trigger('xwing-collection:changed', _this);
      };
    })(this)));
    return $(this.modal.find('input.singleton-count').change((function(_this) {
      return function(e) {
        var target, val, _base1, _name;
        target = $(e.target);
        val = target.val();
        if (val < 0 || isNaN(parseInt(val))) {
          target.val(0);
        }
        ((_base1 = _this.singletons)[_name = target.data('singletonType')] != null ? _base1[_name] : _base1[_name] = {})[target.data('singletonName')] = parseInt(target.val());
        target.closest('div').css('background-color', _this.countToBackgroundColor(val));
        return $(exportObj).trigger('xwing-collection:changed', _this);
      };
    })(this)));
  };

  Collection.prototype.countToBackgroundColor = function(count) {
    var i;
    count = parseInt(count);
    switch (false) {
      case count !== 0:
        return '';
      case !(count < 12):
        i = parseInt(200 * Math.pow(0.9, count - 1));
        return "rgb(" + i + ", 255, " + i + ")";
      default:
        return 'red';
    }
  };

  Collection.prototype.onLanguageChange = function(e, language) {
    if (language !== this.language) {
      (function(_this) {
        return (function(language) {
          return _this.modal.find('.expansion-name').each(function() {
            return $(this).text(exportObj.translate(language, 'sources', $(this).data('english_name')));
          });
        });
      })(this)(language);
      return this.language = language;
    }
  };

  return Collection;

})();


/*
    X-Wing Squad Builder
    Geordan Rosario <geordan@gmail.com>
    https://github.com/geordanr/xwing
 */

DFL_LANGUAGE = 'English';

builders = [];

exportObj = typeof exports !== "undefined" && exports !== null ? exports : this;

exportObj.loadCards = function(language) {
  return exportObj.cardLoaders[language]();
};

exportObj.translate = function() {
  var args, category, language, translation, what;
  language = arguments[0], category = arguments[1], what = arguments[2], args = 4 <= arguments.length ? __slice.call(arguments, 3) : [];
  translation = exportObj.translations[language][category][what];
  if (translation != null) {
    if (translation instanceof Function) {
      return translation.apply(null, [exportObj.translate, language].concat(__slice.call(args)));
    } else {
      return translation;
    }
  } else {
    return what;
  }
};

exportObj.setupTranslationSupport = function() {
  (function(builders) {
    return $(exportObj).on('xwing:languageChanged', (function(_this) {
      return function(e, language, cb) {
        var builder, html, selector, ___iced_passed_deferral, __iced_deferrals, __iced_k;
        __iced_k = __iced_k_noop;
        ___iced_passed_deferral = iced.findDeferral(arguments);
        if (cb == null) {
          cb = $.noop;
        }
        if (language in exportObj.translations) {
          $('.language-placeholder').text(language);
          (function(__iced_k) {
            var _i, _len, _ref, _results, _while;
            _ref = builders;
            _len = _ref.length;
            _i = 0;
            _while = function(__iced_k) {
              var _break, _continue, _next;
              _break = __iced_k;
              _continue = function() {
                return iced.trampoline(function() {
                  ++_i;
                  return _while(__iced_k);
                });
              };
              _next = _continue;
              if (!(_i < _len)) {
                return _break();
              } else {
                builder = _ref[_i];
                (function(__iced_k) {
                  __iced_deferrals = new iced.Deferrals(__iced_k, {
                    parent: ___iced_passed_deferral
                  });
                  builder.container.trigger('xwing:beforeLanguageLoad', __iced_deferrals.defer({
                    lineno: 17791
                  }));
                  __iced_deferrals._fulfill();
                })(_next);
              }
            };
            _while(__iced_k);
          })(function() {
            var _i, _len, _ref;
            exportObj.loadCards(language);
            _ref = exportObj.translations[language].byCSSSelector;
            for (selector in _ref) {
              if (!__hasProp.call(_ref, selector)) continue;
              html = _ref[selector];
              $(selector).html(html);
            }
            for (_i = 0, _len = builders.length; _i < _len; _i++) {
              builder = builders[_i];
              builder.container.trigger('xwing:afterLanguageLoad', language);
            }
            return __iced_k();
          });
        } else {
          return __iced_k();
        }
      };
    })(this));
  })(builders);
  exportObj.loadCards(DFL_LANGUAGE);
  return $(exportObj).trigger('xwing:languageChanged', DFL_LANGUAGE);
};

exportObj.setupTranslationUI = function(backend) {
  var language, li, _fn, _i, _len, _ref, _results;
  _ref = Object.keys(exportObj.cardLoaders).sort();
  _fn = function(language, backend) {
    return li.click(function(e) {
      if (backend != null) {
        backend.set('language', language);
      }
      return $(exportObj).trigger('xwing:languageChanged', language);
    });
  };
  _results = [];
  for (_i = 0, _len = _ref.length; _i < _len; _i++) {
    language = _ref[_i];
    li = $(document.createElement('LI'));
    li.text(language);
    _fn(language, backend);
    _results.push($('ul.dropdown-menu').append(li));
  }
  return _results;
};

exportObj.registerBuilderForTranslation = function(builder) {
  if (__indexOf.call(builders, builder) < 0) {
    return builders.push(builder);
  }
};


/*
    X-Wing Squad Builder
    Geordan Rosario <geordan@gmail.com>
    https://github.com/geordanr/xwing
 */

exportObj = typeof exports !== "undefined" && exports !== null ? exports : this;

exportObj.sortHelper = function(a, b) {
  var a_name, b_name;
  if (a.points === b.points) {
    a_name = a.text.replace(/[^a-z0-9]/ig, '');
    b_name = b.text.replace(/[^a-z0-9]/ig, '');
    if (a_name === b_name) {
      return 0;
    } else {
      if (a_name > b_name) {
        return 1;
      } else {
        return -1;
      }
    }
  } else {
    if (a.points > b.points) {
      return 1;
    } else {
      return -1;
    }
  }
};

$.isMobile = function() {
  return navigator.userAgent.match(/(iPhone|iPod|iPad|Android)/i);
};

$.randomInt = function(n) {
  return Math.floor(Math.random() * n);
};

$.getParameterByName = function(name) {
  var regex, regexS, results;
  name = name.replace(/[\[]/, "\\\[").replace(/[\]]/, "\\\]");
  regexS = "[\\?&]" + name + "=([^&#]*)";
  regex = new RegExp(regexS);
  results = regex.exec(window.location.search);
  if (results === null) {
    return "";
  } else {
    return decodeURIComponent(results[1].replace(/\+/g, " "));
  }
};

Array.prototype.intersects = function(other) {
  var item, _i, _len;
  for (_i = 0, _len = this.length; _i < _len; _i++) {
    item = this[_i];
    if (__indexOf.call(other, item) >= 0) {
      return true;
    }
  }
  return false;
};

Array.prototype.removeItem = function(item) {
  var idx;
  idx = this.indexOf(item);
  if (idx !== -1) {
    this.splice(idx, 1);
  }
  return this;
};

String.prototype.capitalize = function() {
  return this.charAt(0).toUpperCase() + this.slice(1);
};

String.prototype.getXWSBaseName = function() {
  return this.split('-')[0];
};

URL_BASE = "" + window.location.protocol + "//" + window.location.host + window.location.pathname;

SQUAD_DISPLAY_NAME_MAX_LENGTH = 24;

statAndEffectiveStat = function(base_stat, effective_stats, key) {
  return "" + base_stat + (effective_stats[key] !== base_stat ? " (" + effective_stats[key] + ")" : "");
};

getPrimaryFaction = function(faction) {
  switch (faction) {
    case 'Rebel Alliance':
    case 'Resistance':
      return 'Rebel Alliance';
    case 'Galactic Empire':
    case 'First Order':
      return 'Galactic Empire';
    default:
      return faction;
  }
};

conditionToHTML = function(condition) {
  var html;
  return html = $.trim("<div class=\"condition\">\n    <div class=\"name\">" + (condition.unique ? "&middot;&nbsp;" : "") + condition.name + "</div>\n    <div class=\"text\">" + condition.text + "</div>\n</div>");
};

exportObj.SquadBuilder = (function() {
  var dfl_filter_func;

  function SquadBuilder(args) {
    this._makeRandomizerLoopFunc = __bind(this._makeRandomizerLoopFunc, this);
    this._randomizerLoopBody = __bind(this._randomizerLoopBody, this);
    this.releaseUnique = __bind(this.releaseUnique, this);
    this.claimUnique = __bind(this.claimUnique, this);
    this.onSquadNameChanged = __bind(this.onSquadNameChanged, this);
    this.onSquadDirtinessChanged = __bind(this.onSquadDirtinessChanged, this);
    this.onSquadLoadRequested = __bind(this.onSquadLoadRequested, this);
    this.onPointsUpdated = __bind(this.onPointsUpdated, this);
    this.onGameTypeChanged = __bind(this.onGameTypeChanged, this);
    this.onNotesUpdated = __bind(this.onNotesUpdated, this);
    this.updatePermaLink = __bind(this.updatePermaLink, this);
    this.getPermaLink = __bind(this.getPermaLink, this);
    this.getPermaLinkParams = __bind(this.getPermaLinkParams, this);
    this.container = $(args.container);
    this.faction = $.trim(args.faction);
    this.printable_container = $(args.printable_container);
    this.tab = $(args.tab);
    this.ships = [];
    this.uniques_in_use = {
      Pilot: [],
      Upgrade: [],
      Modification: [],
      Title: []
    };
    this.suppress_automatic_new_ship = false;
    this.tooltip_currently_displaying = null;
    this.randomizer_options = {
      sources: null,
      points: 100
    };
    this.total_points = 0;
    this.isCustom = false;
    this.isEpic = false;
    this.maxEpicPointsAllowed = 0;
    this.maxSmallShipsOfOneType = null;
    this.maxLargeShipsOfOneType = null;
    this.backend = null;
    this.current_squad = {};
    this.language = 'English';
    this.collection = null;
    this.current_obstacles = [];
    this.setupUI();
    this.setupEventHandlers();
    window.setInterval(this.updatePermaLink, 250);
    this.isUpdatingPoints = false;
    if ($.getParameterByName('f') === this.faction) {
      this.resetCurrentSquad(true);
      this.loadFromSerialized($.getParameterByName('d'));
    } else {
      this.resetCurrentSquad();
      this.addShip();
    }
  }

  SquadBuilder.prototype.resetCurrentSquad = function(initial_load) {
    var default_squad_name, squad_name, squad_obstacles;
    if (initial_load == null) {
      initial_load = false;
    }
    default_squad_name = 'Unnamed Squadron';
    squad_name = $.trim(this.squad_name_input.val()) || default_squad_name;
    if (initial_load && $.trim($.getParameterByName('sn'))) {
      squad_name = $.trim($.getParameterByName('sn'));
    }
    squad_obstacles = [];
    if (initial_load && $.trim($.getParameterByName('obs'))) {
      squad_obstacles = ($.trim($.getParameterByName('obs'))).split(",").slice(0, 3);
      this.current_obstacles = squad_obstacles;
    } else if (this.current_obstacles) {
      squad_obstacles = this.current_obstacles;
    }
    this.current_squad = {
      id: null,
      name: squad_name,
      dirty: false,
      additional_data: {
        points: this.total_points,
        description: '',
        cards: [],
        notes: '',
        obstacles: squad_obstacles
      },
      faction: this.faction
    };
    if (this.total_points > 0) {
      if (squad_name === default_squad_name) {
        this.current_squad.name = 'Unsaved Squadron';
      }
      this.current_squad.dirty = true;
    }
    this.container.trigger('xwing-backend:squadNameChanged');
    return this.container.trigger('xwing-backend:squadDirtinessChanged');
  };

  SquadBuilder.prototype.newSquadFromScratch = function() {
    this.squad_name_input.val('New Squadron');
    this.removeAllShips();
    this.addShip();
    this.current_obstacles = [];
    this.resetCurrentSquad();
    return this.notes.val('');
  };

  SquadBuilder.prototype.setupUI = function() {
    var DEFAULT_RANDOMIZER_ITERATIONS, DEFAULT_RANDOMIZER_POINTS, DEFAULT_RANDOMIZER_TIMEOUT_SEC, content_container, expansion, opt, _i, _len, _ref;
    DEFAULT_RANDOMIZER_POINTS = 100;
    DEFAULT_RANDOMIZER_TIMEOUT_SEC = 2;
    DEFAULT_RANDOMIZER_ITERATIONS = 1000;
    this.status_container = $(document.createElement('DIV'));
    this.status_container.addClass('container-fluid');
    this.status_container.append($.trim('<div class="row-fluid">\n    <div class="span3 squad-name-container">\n        <div class="display-name">\n            <span class="squad-name"></span>\n            <i class="fa fa-pencil"></i>\n        </div>\n        <div class="input-append">\n            <input type="text" maxlength="64" placeholder="Name your squad..." />\n        </div>\n    </div>\n    <div class="span4 points-display-container">\n        Points: <span class="total-points">0</span> / <input type="number" class="desired-points" value="100">\n        <select class="game-type-selector">\n            <option value="standard">Standard</option>\n        </select>\n        <span class="points-remaining-container">(<span class="points-remaining"></span>&nbsp;left)</span>\n        <span class="total-epic-points-container hidden"><br /><span class="total-epic-points">0</span> / <span class="max-epic-points">5</span> Epic Points</span>\n        <span class="content-warning unreleased-content-used hidden"><br /><i class="fa fa-exclamation-circle"></i>&nbsp;<span class="translated"></span></span>\n        <span class="content-warning epic-content-used hidden"><br /><i class="fa fa-exclamation-circle"></i>&nbsp;<span class="translated"></span></span>\n        <span class="content-warning illegal-epic-upgrades hidden"><br /><i class="fa fa-exclamation-circle"></i>&nbsp;Navigator cannot be equipped onto Huge ships in Epic tournament play!</span>\n        <span class="content-warning illegal-epic-too-many-small-ships hidden"><br /><i class="fa fa-exclamation-circle"></i>&nbsp;<span class="translated"></span></span>\n        <span class="content-warning illegal-epic-too-many-large-ships hidden"><br /><i class="fa fa-exclamation-circle"></i>&nbsp;<span class="translated"></span></span>\n        <span class="content-warning collection-invalid hidden"><br /><i class="fa fa-exclamation-circle"></i>&nbsp;<span class="translated"></span></span>\n    </div>\n    <div class="span5 pull-right button-container">\n        <div class="btn-group pull-right">\n\n            <button class="btn btn-primary view-as-text"><span class="hidden-phone"><i class="fa fa-print"></i>&nbsp;Print/View as </span>Text</button>\n            <!-- <button class="btn btn-primary print-list hidden-phone hidden-tablet"><i class="fa fa-print"></i>&nbsp;Print</button> -->\n            <a class="btn btn-primary hidden collection"><i class="fa fa-folder-open hidden-phone hidden-tabler"></i>&nbsp;Your Collection</a>\n\n            <!--\n            <button class="btn btn-primary randomize" ><i class="fa fa-random hidden-phone hidden-tablet"></i>&nbsp;Random!</button>\n            <button class="btn btn-primary dropdown-toggle" data-toggle="dropdown">\n                <span class="caret"></span>\n            </button>\n            <ul class="dropdown-menu">\n                <li><a class="randomize-options">Randomizer Options...</a></li>\n            </ul>\n            -->\n\n        </div>\n    </div>\n</div>'));
    this.container.append(this.status_container);
    this.list_modal = $(document.createElement('DIV'));
    this.list_modal.addClass('modal hide fade text-list-modal');
    this.container.append(this.list_modal);
    this.list_modal.append($.trim("<div class=\"modal-header\">\n    <button type=\"button\" class=\"close hidden-print\" data-dismiss=\"modal\" aria-hidden=\"true\">&times;</button>\n\n    <div class=\"hidden-phone hidden-print\">\n        <h3><span class=\"squad-name\"></span> (<span class=\"total-points\"></span>)<h3>\n    </div>\n\n    <div class=\"visible-phone hidden-print\">\n        <h4><span class=\"squad-name\"></span> (<span class=\"total-points\"></span>)<h4>\n    </div>\n\n    <div class=\"visible-print\">\n        <div class=\"fancy-header\">\n            <div class=\"squad-name\"></div>\n            <div class=\"squad-faction\"></div>\n            <div class=\"mask\">\n                <div class=\"outer-circle\">\n                    <div class=\"inner-circle\">\n                        <span class=\"total-points\"></span>\n                    </div>\n                </div>\n            </div>\n        </div>\n        <div class=\"fancy-under-header\"></div>\n    </div>\n\n</div>\n<div class=\"modal-body\">\n    <div class=\"fancy-list hidden-phone\"></div>\n    <div class=\"simple-list\"></div>\n    <div class=\"bbcode-list\">\n        <p>Copy the BBCode below and paste it into your forum post.</p>\n        <textarea></textarea><button class=\"btn btn-copy\">Copy</button>\n    </div>\n    <div class=\"html-list\">\n        <textarea></textarea><button class=\"btn btn-copy\">Copy</button>\n    </div>\n</div>\n<div class=\"modal-footer hidden-print\">\n    <label class=\"vertical-space-checkbox\">\n        Add space for damage/upgrade cards when printing <input type=\"checkbox\" class=\"toggle-vertical-space\" />\n    </label>\n    <label class=\"color-print-checkbox\">\n        Print color <input type=\"checkbox\" class=\"toggle-color-print\" />\n    </label>\n    <label class=\"qrcode-checkbox hidden-phone\">\n        Include QR codes <input type=\"checkbox\" class=\"toggle-juggler-qrcode\" checked=\"checked\" />\n    </label>\n    <label class=\"qrcode-checkbox hidden-phone\">\n        Include obstacle/damage deck choices <input type=\"checkbox\" class=\"toggle-obstacles\" />\n    </label>\n    <div class=\"btn-group list-display-mode\">\n        <button class=\"btn select-simple-view\">Simple</button>\n        <button class=\"btn select-fancy-view hidden-phone\">Fancy</button>\n        <button class=\"btn select-bbcode-view\">BBCode</button>\n        <button class=\"btn select-html-view\">HTML</button>\n    </div>\n    <button class=\"btn print-list hidden-phone\"><i class=\"fa fa-print\"></i>&nbsp;Print</button>\n    <button class=\"btn close-print-dialog\" data-dismiss=\"modal\" aria-hidden=\"true\">Close</button>\n</div>"));
    this.fancy_container = $(this.list_modal.find('div.modal-body .fancy-list'));
    this.fancy_total_points_container = $(this.list_modal.find('div.modal-header .total-points'));
    this.simple_container = $(this.list_modal.find('div.modal-body .simple-list'));
    this.bbcode_container = $(this.list_modal.find('div.modal-body .bbcode-list'));
    this.bbcode_textarea = $(this.bbcode_container.find('textarea'));
    this.bbcode_textarea.attr('readonly', 'readonly');
    this.htmlview_container = $(this.list_modal.find('div.modal-body .html-list'));
    this.html_textarea = $(this.htmlview_container.find('textarea'));
    this.html_textarea.attr('readonly', 'readonly');
    this.toggle_vertical_space_container = $(this.list_modal.find('.vertical-space-checkbox'));
    this.toggle_color_print_container = $(this.list_modal.find('.color-print-checkbox'));
    this.list_modal.on('click', 'button.btn-copy', (function(_this) {
      return function(e) {
        _this.self = $(e.currentTarget);
        _this.self.siblings('textarea').select();
        _this.success = document.execCommand('copy');
        if (_this.success) {
          _this.self.addClass('btn-success');
          return setTimeout((function() {
            return _this.self.removeClass('btn-success');
          }), 1000);
        }
      };
    })(this));
    this.select_simple_view_button = $(this.list_modal.find('.select-simple-view'));
    this.select_simple_view_button.click((function(_this) {
      return function(e) {
        _this.select_simple_view_button.blur();
        if (_this.list_display_mode !== 'simple') {
          _this.list_modal.find('.list-display-mode .btn').removeClass('btn-inverse');
          _this.select_simple_view_button.addClass('btn-inverse');
          _this.list_display_mode = 'simple';
          _this.simple_container.show();
          _this.fancy_container.hide();
          _this.bbcode_container.hide();
          _this.htmlview_container.hide();
          _this.toggle_vertical_space_container.hide();
          return _this.toggle_color_print_container.hide();
        }
      };
    })(this));
    this.select_fancy_view_button = $(this.list_modal.find('.select-fancy-view'));
    this.select_fancy_view_button.click((function(_this) {
      return function(e) {
        _this.select_fancy_view_button.blur();
        if (_this.list_display_mode !== 'fancy') {
          _this.list_modal.find('.list-display-mode .btn').removeClass('btn-inverse');
          _this.select_fancy_view_button.addClass('btn-inverse');
          _this.list_display_mode = 'fancy';
          _this.fancy_container.show();
          _this.simple_container.hide();
          _this.bbcode_container.hide();
          _this.htmlview_container.hide();
          _this.toggle_vertical_space_container.show();
          return _this.toggle_color_print_container.show();
        }
      };
    })(this));
    this.select_bbcode_view_button = $(this.list_modal.find('.select-bbcode-view'));
    this.select_bbcode_view_button.click((function(_this) {
      return function(e) {
        _this.select_bbcode_view_button.blur();
        if (_this.list_display_mode !== 'bbcode') {
          _this.list_modal.find('.list-display-mode .btn').removeClass('btn-inverse');
          _this.select_bbcode_view_button.addClass('btn-inverse');
          _this.list_display_mode = 'bbcode';
          _this.bbcode_container.show();
          _this.htmlview_container.hide();
          _this.simple_container.hide();
          _this.fancy_container.hide();
          _this.bbcode_textarea.select();
          _this.bbcode_textarea.focus();
          _this.toggle_vertical_space_container.show();
          return _this.toggle_color_print_container.show();
        }
      };
    })(this));
    this.select_html_view_button = $(this.list_modal.find('.select-html-view'));
    this.select_html_view_button.click((function(_this) {
      return function(e) {
        _this.select_html_view_button.blur();
        if (_this.list_display_mode !== 'html') {
          _this.list_modal.find('.list-display-mode .btn').removeClass('btn-inverse');
          _this.select_html_view_button.addClass('btn-inverse');
          _this.list_display_mode = 'html';
          _this.bbcode_container.hide();
          _this.htmlview_container.show();
          _this.simple_container.hide();
          _this.fancy_container.hide();
          _this.html_textarea.select();
          _this.html_textarea.focus();
          _this.toggle_vertical_space_container.show();
          return _this.toggle_color_print_container.show();
        }
      };
    })(this));
    if ($(window).width() >= 768) {
      this.simple_container.hide();
      this.select_fancy_view_button.click();
    } else {
      this.select_simple_view_button.click();
    }
    this.clear_squad_button = $(this.status_container.find('.clear-squad'));
    this.clear_squad_button.click((function(_this) {
      return function(e) {
        if (_this.current_squad.dirty && (_this.backend != null)) {
          return _this.backend.warnUnsaved(_this, function() {
            return _this.newSquadFromScratch();
          });
        } else {
          return _this.newSquadFromScratch();
        }
      };
    })(this));
    this.squad_name_container = $(this.status_container.find('div.squad-name-container'));
    this.squad_name_display = $(this.container.find('.display-name'));
    this.squad_name_placeholder = $(this.container.find('.squad-name'));
    this.squad_name_input = $(this.squad_name_container.find('input'));
    this.squad_name_save_button = $(this.squad_name_container.find('button.save'));
    this.squad_name_input.closest('div').hide();
    this.points_container = $(this.status_container.find('div.points-display-container'));
    this.total_points_span = $(this.points_container.find('.total-points'));
    this.game_type_selector = $(this.status_container.find('.game-type-selector'));
    this.game_type_selector.change((function(_this) {
      return function(e) {
        return _this.onGameTypeChanged(_this.game_type_selector.val());
      };
    })(this));
    this.desired_points_input = $(this.points_container.find('.desired-points'));
    this.desired_points_input.change((function(_this) {
      return function(e) {
        _this.game_type_selector.val('custom');
        return _this.onGameTypeChanged('custom');
      };
    })(this));
    this.points_remaining_span = $(this.points_container.find('.points-remaining'));
    this.points_remaining_container = $(this.points_container.find('.points-remaining-container'));
    this.unreleased_content_used_container = $(this.points_container.find('.unreleased-content-used'));
    this.epic_content_used_container = $(this.points_container.find('.epic-content-used'));
    this.illegal_epic_upgrades_container = $(this.points_container.find('.illegal-epic-upgrades'));
    this.too_many_small_ships_container = $(this.points_container.find('.illegal-epic-too-many-small-ships'));
    this.too_many_large_ships_container = $(this.points_container.find('.illegal-epic-too-many-large-ships'));
    this.collection_invalid_container = $(this.points_container.find('.collection-invalid'));
    this.total_epic_points_container = $(this.points_container.find('.total-epic-points-container'));
    this.total_epic_points_span = $(this.total_epic_points_container.find('.total-epic-points'));
    this.max_epic_points_span = $(this.points_container.find('.max-epic-points'));
    this.view_list_button = $(this.status_container.find('div.button-container button.view-as-text'));
    this.randomize_button = $(this.status_container.find('div.button-container button.randomize'));
    this.customize_randomizer = $(this.status_container.find('div.button-container a.randomize-options'));
    this.backend_status = $(this.status_container.find('.backend-status'));
    this.backend_status.hide();
    this.collection_button = $(this.status_container.find('div.button-container a.collection'));
    this.collection_button.click((function(_this) {
      return function(e) {
        e.preventDefault();
        if (!_this.collection_button.prop('disabled')) {
          return _this.collection.modal.modal('show');
        }
      };
    })(this));
    this.squad_name_input.keypress((function(_this) {
      return function(e) {
        if (e.which === 13) {
          _this.squad_name_save_button.click();
          return false;
        }
      };
    })(this));
    this.squad_name_input.change((function(_this) {
      return function(e) {
        return _this.backend_status.fadeOut('slow');
      };
    })(this));
    this.squad_name_input.blur((function(_this) {
      return function(e) {
        _this.squad_name_input.change();
        return _this.squad_name_save_button.click();
      };
    })(this));
    this.squad_name_display.click((function(_this) {
      return function(e) {
        e.preventDefault();
        _this.squad_name_display.hide();
        _this.squad_name_input.val($.trim(_this.current_squad.name));
        window.setTimeout(function() {
          _this.squad_name_input.focus();
          return _this.squad_name_input.select();
        }, 100);
        return _this.squad_name_input.closest('div').show();
      };
    })(this));
    this.squad_name_save_button.click((function(_this) {
      return function(e) {
        var name;
        e.preventDefault();
        _this.current_squad.dirty = true;
        _this.container.trigger('xwing-backend:squadDirtinessChanged');
        name = _this.current_squad.name = $.trim(_this.squad_name_input.val());
        if (name.length > 0) {
          _this.squad_name_display.show();
          _this.container.trigger('xwing-backend:squadNameChanged');
          return _this.squad_name_input.closest('div').hide();
        }
      };
    })(this));
    this.randomizer_options_modal = $(document.createElement('DIV'));
    this.randomizer_options_modal.addClass('modal hide fade');
    $('body').append(this.randomizer_options_modal);
    this.randomizer_options_modal.append($.trim("<div class=\"modal-header\">\n    <button type=\"button\" class=\"close\" data-dismiss=\"modal\" aria-hidden=\"true\">&times;</button>\n    <h3>Random Squad Builder Options</h3>\n</div>\n<div class=\"modal-body\">\n    <form>\n        <label>\n            Desired Points\n            <input type=\"number\" class=\"randomizer-points\" value=\"" + DEFAULT_RANDOMIZER_POINTS + "\" placeholder=\"" + DEFAULT_RANDOMIZER_POINTS + "\" />\n        </label>\n        <label>\n            Sets and Expansions (default all)\n            <select class=\"randomizer-sources\" multiple=\"1\" data-placeholder=\"Use all sets and expansions\">\n            </select>\n        </label>\n        <label>\n            Maximum Seconds to Spend Randomizing\n            <input type=\"number\" class=\"randomizer-timeout\" value=\"" + DEFAULT_RANDOMIZER_TIMEOUT_SEC + "\" placeholder=\"" + DEFAULT_RANDOMIZER_TIMEOUT_SEC + "\" />\n        </label>\n        <label>\n            Maximum Randomization Iterations\n            <input type=\"number\" class=\"randomizer-iterations\" value=\"" + DEFAULT_RANDOMIZER_ITERATIONS + "\" placeholder=\"" + DEFAULT_RANDOMIZER_ITERATIONS + "\" />\n        </label>\n    </form>\n</div>\n<div class=\"modal-footer\">\n    <button class=\"btn btn-primary do-randomize\" aria-hidden=\"true\">Randomize!</button>\n    <button class=\"btn\" data-dismiss=\"modal\" aria-hidden=\"true\">Close</button>\n</div>"));
    this.randomizer_source_selector = $(this.randomizer_options_modal.find('select.randomizer-sources'));
    _ref = exportObj.expansions;
    for (_i = 0, _len = _ref.length; _i < _len; _i++) {
      expansion = _ref[_i];
      opt = $(document.createElement('OPTION'));
      opt.text(expansion);
      this.randomizer_source_selector.append(opt);
    }
    this.randomizer_source_selector.select2({
      width: "100%",
      minimumResultsForSearch: $.isMobile() ? -1 : 0
    });
    this.randomize_button.click((function(_this) {
      return function(e) {
        var iterations, points, timeout_sec;
        e.preventDefault();
        if (_this.current_squad.dirty && (_this.backend != null)) {
          return _this.backend.warnUnsaved(_this, function() {
            return _this.randomize_button.click();
          });
        } else {
          points = parseInt($(_this.randomizer_options_modal.find('.randomizer-points')).val());
          if (isNaN(points) || points <= 0) {
            points = DEFAULT_RANDOMIZER_POINTS;
          }
          timeout_sec = parseInt($(_this.randomizer_options_modal.find('.randomizer-timeout')).val());
          if (isNaN(timeout_sec) || timeout_sec <= 0) {
            timeout_sec = DEFAULT_RANDOMIZER_TIMEOUT_SEC;
          }
          iterations = parseInt($(_this.randomizer_options_modal.find('.randomizer-iterations')).val());
          if (isNaN(iterations) || iterations <= 0) {
            iterations = DEFAULT_RANDOMIZER_ITERATIONS;
          }
          return _this.randomSquad(points, _this.randomizer_source_selector.val(), DEFAULT_RANDOMIZER_TIMEOUT_SEC * 1000, iterations);
        }
      };
    })(this));
    this.randomizer_options_modal.find('button.do-randomize').click((function(_this) {
      return function(e) {
        e.preventDefault();
        _this.randomizer_options_modal.modal('hide');
        return _this.randomize_button.click();
      };
    })(this));
    this.customize_randomizer.click((function(_this) {
      return function(e) {
        e.preventDefault();
        return _this.randomizer_options_modal.modal();
      };
    })(this));
    this.choose_obstacles_modal = $(document.createElement('DIV'));
    this.choose_obstacles_modal.addClass('modal hide fade choose-obstacles-modal');
    this.container.append(this.choose_obstacles_modal);
    this.choose_obstacles_modal.append($.trim("<div class=\"modal-header\">\n    <label class='choose-obstacles-description'>Choose up to three obstacles, to include in the permalink for use in external programs</label>\n</div>\n<div class=\"modal-body\">\n    <div class=\"obstacle-select-container\" style=\"float:left\">\n        <select multiple class='obstacle-select' size=\"18\">\n            <option class=\"coreasteroid0-select\" value=\"coreasteroid0\">Core Asteroid 0</option>\n            <option class=\"coreasteroid1-select\" value=\"coreasteroid1\">Core Asteroid 1</option>\n            <option class=\"coreasteroid2-select\" value=\"coreasteroid2\">Core Asteroid 2</option>\n            <option class=\"coreasteroid3-select\" value=\"coreasteroid3\">Core Asteroid 3</option>\n            <option class=\"coreasteroid4-select\" value=\"coreasteroid4\">Core Asteroid 4</option>\n            <option class=\"coreasteroid5-select\" value=\"coreasteroid5\">Core Asteroid 5</option>\n            <option class=\"yt2400debris0-select\" value=\"yt2400debris0\">YT2400 Debris 0</option>\n            <option class=\"yt2400debris1-select\" value=\"yt2400debris1\">YT2400 Debris 1</option>\n            <option class=\"yt2400debris2-select\" value=\"yt2400debris2\">YT2400 Debris 2</option>\n            <option class=\"vt49decimatordebris0-select\" value=\"vt49decimatordebris0\">VT49 Debris 0</option>\n            <option class=\"vt49decimatordebris1-select\" value=\"vt49decimatordebris1\">VT49 Debris 1</option>\n            <option class=\"vt49decimatordebris2-select\" value=\"vt49decimatordebris2\">VT49 Debris 2</option>\n            <option class=\"core2asteroid0-select\" value=\"core2asteroid0\">Force Awakens Asteroid 0</option>\n            <option class=\"core2asteroid1-select\" value=\"core2asteroid1\">Force Awakens Asteroid 1</option>\n            <option class=\"core2asteroid2-select\" value=\"core2asteroid2\">Force Awakens Asteroid 2</option>\n            <option class=\"core2asteroid3-select\" value=\"core2asteroid3\">Force Awakens Asteroid 3</option>\n            <option class=\"core2asteroid4-select\" value=\"core2asteroid4\">Force Awakens Asteroid 4</option>\n            <option class=\"core2asteroid5-select\" value=\"core2asteroid5\">Force Awakens Asteroid 5</option>\n        </select>\n    </div>\n    <div class=\"obstacle-image-container\" style=\"display:none;\">\n        <img class=\"obstacle-image\" src=\"images/core2asteroid0.png\" />\n    </div>\n</div>\n<div class=\"modal-footer hidden-print\">\n    <button class=\"btn close-print-dialog\" data-dismiss=\"modal\" aria-hidden=\"true\">Close</button>\n</div>"));
    this.obstacles_select = this.choose_obstacles_modal.find('.obstacle-select');
    this.obstacles_select_image = this.choose_obstacles_modal.find('.obstacle-image-container');
    this.backend_list_squads_button = $(this.container.find('button.backend-list-my-squads'));
    this.backend_list_squads_button.click((function(_this) {
      return function(e) {
        e.preventDefault();
        if (_this.backend != null) {
          return _this.backend.list(_this);
        }
      };
    })(this));
    this.backend_save_list_button = $(this.container.find('button.save-list'));
    this.backend_save_list_button.click((function(_this) {
      return function(e) {
        var additional_data, results, ___iced_passed_deferral, __iced_deferrals, __iced_k;
        __iced_k = __iced_k_noop;
        ___iced_passed_deferral = iced.findDeferral(arguments);
        e.preventDefault();
        if ((_this.backend != null) && !_this.backend_save_list_button.hasClass('disabled')) {
          additional_data = {
            points: _this.total_points,
            description: _this.describeSquad(),
            cards: _this.listCards(),
            notes: _this.notes.val().substr(0, 1024),
            obstacles: _this.getObstacles()
          };
          _this.backend_status.html($.trim("<i class=\"fa fa-refresh fa-spin\"></i>&nbsp;Saving squad..."));
          _this.backend_status.show();
          _this.backend_save_list_button.addClass('disabled');
          (function(__iced_k) {
            __iced_deferrals = new iced.Deferrals(__iced_k, {
              parent: ___iced_passed_deferral
            });
            _this.backend.save(_this.serialize(), _this.current_squad.id, _this.current_squad.name, _this.faction, additional_data, __iced_deferrals.defer({
              assign_fn: (function() {
                return function() {
                  return results = arguments[0];
                };
              })(),
              lineno: 18406
            }));
            __iced_deferrals._fulfill();
          })(function() {
            return __iced_k(results.success ? (_this.current_squad.dirty = false, _this.current_squad.id != null ? _this.backend_status.html($.trim("<i class=\"fa fa-check\"></i>&nbsp;Squad updated successfully.")) : (_this.backend_status.html($.trim("<i class=\"fa fa-check\"></i>&nbsp;New squad saved successfully.")), _this.current_squad.id = results.id), _this.container.trigger('xwing-backend:squadDirtinessChanged')) : (_this.backend_status.html($.trim("<i class=\"fa fa-exclamation-circle\"></i>&nbsp;" + results.error)), _this.backend_save_list_button.removeClass('disabled')));
          });
        } else {
          return __iced_k();
        }
      };
    })(this));
    this.backend_save_list_as_button = $(this.container.find('button.save-list-as'));
    this.backend_save_list_as_button.addClass('disabled');
    this.backend_save_list_as_button.click((function(_this) {
      return function(e) {
        e.preventDefault();
        if ((_this.backend != null) && !_this.backend_save_list_as_button.hasClass('disabled')) {
          return _this.backend.showSaveAsModal(_this);
        }
      };
    })(this));
    this.backend_delete_list_button = $(this.container.find('button.delete-list'));
    this.backend_delete_list_button.click((function(_this) {
      return function(e) {
        e.preventDefault();
        if ((_this.backend != null) && !_this.backend_delete_list_button.hasClass('disabled')) {
          return _this.backend.showDeleteModal(_this);
        }
      };
    })(this));
    content_container = $(document.createElement('DIV'));
    content_container.addClass('container-fluid');
    this.container.append(content_container);
    content_container.append($.trim("<div class=\"row-fluid\">\n    <div class=\"span9 ship-container\">\n        <label class=\"notes-container show-authenticated\">\n            <span class=\"squad-notes\">Squad Notes:</span>\n            <br />\n            <textarea class=\"squad-notes\"></textarea>\n        </label>\n        <span class=\"obstacles-container\">\n        </span>\n     </div>\n   <div class=\"span3 info-container\" />\n</div>"));
    this.ship_container = $(content_container.find('div.ship-container'));
    this.info_container = $(content_container.find('div.info-container'));
    this.obstacles_container = content_container.find('.obstacles-container');
    this.notes_container = $(content_container.find('.notes-container'));
    this.notes = $(this.notes_container.find('textarea.squad-notes'));
    this.info_container.append($.trim("<div class=\"well well-small info-well\">\n    <span class=\"info-name\"></span>\n    <br />\n    <span class=\"info-sources\"></span>\n    <br />\n    <span class=\"info-collection\"></span>\n    <table>\n        <tbody>\n            <tr class=\"info-ship\">\n                <td class=\"info-header\">Ship</td>\n                <td class=\"info-data\"></td>\n            </tr>\n            <tr class=\"info-skill\">\n                <td class=\"info-header\">Skill</td>\n                <td class=\"info-data info-skill\"></td>\n            </tr>\n            <tr class=\"info-energy\">\n                <td class=\"info-header\"><i class=\"xwing-miniatures-font xwing-miniatures-font-energy\"></i></td>\n                <td class=\"info-data info-energy\"></td>\n            </tr>\n            <tr class=\"info-attack\">\n                <td class=\"info-header\"><i class=\"xwing-miniatures-font xwing-miniatures-font-attack\"></i></td>\n                <td class=\"info-data info-attack\"></td>\n            </tr>\n            <tr class=\"info-range\">\n                <td class=\"info-header\">Range</td>\n                <td class=\"info-data info-range\"></td>\n            </tr>\n            <tr class=\"info-agility\">\n                <td class=\"info-header\"><i class=\"xwing-miniatures-font xwing-miniatures-font-agility\"></i></td>\n                <td class=\"info-data info-agility\"></td>\n            </tr>\n            <tr class=\"info-hull\">\n                <td class=\"info-header\"><i class=\"xwing-miniatures-font xwing-miniatures-font-hull\"></i></td>\n                <td class=\"info-data info-hull\"></td>\n            </tr>\n            <tr class=\"info-shields\">\n                <td class=\"info-header\"><i class=\"xwing-miniatures-font xwing-miniatures-font-shield\"></i></td>\n                <td class=\"info-data info-shields\"></td>\n            </tr>\n            <tr class=\"info-actions\">\n                <td class=\"info-header\">Actions</td>\n                <td class=\"info-data\"></td>\n            </tr>\n            <tr class=\"info-upgrades\">\n                <td class=\"info-header\">Upgrades</td>\n                <td class=\"info-data\"></td>\n            </tr>\n        </tbody>\n    </table>\n    <p class=\"info-text\" />\n    <p class=\"info-maneuvers\" />\n</div>"));
    this.info_container.hide();
    this.print_list_button = $(this.container.find('button.print-list'));
    this.container.find('[rel=tooltip]').tooltip();
    this.obstacles_button = $(this.container.find('button.choose-obstacles'));
    this.obstacles_button.click((function(_this) {
      return function(e) {
        e.preventDefault();
        return _this.showChooseObstaclesModal();
      };
    })(this));
    this.condition_container = $(document.createElement('div'));
    this.condition_container.addClass('conditions-container');
    return this.container.append(this.condition_container);
  };

  SquadBuilder.prototype.setupEventHandlers = function() {
    this.container.on('xwing:claimUnique', (function(_this) {
      return function(e, unique, type, cb) {
        return _this.claimUnique(unique, type, cb);
      };
    })(this)).on('xwing:releaseUnique', (function(_this) {
      return function(e, unique, type, cb) {
        return _this.releaseUnique(unique, type, cb);
      };
    })(this)).on('xwing:pointsUpdated', (function(_this) {
      return function(e, cb) {
        if (cb == null) {
          cb = $.noop;
        }
        if (_this.isUpdatingPoints) {
          return cb();
        } else {
          _this.isUpdatingPoints = true;
          return _this.onPointsUpdated(function() {
            _this.isUpdatingPoints = false;
            return cb();
          });
        }
      };
    })(this)).on('xwing-backend:squadLoadRequested', (function(_this) {
      return function(e, squad) {
        return _this.onSquadLoadRequested(squad);
      };
    })(this)).on('xwing-backend:squadDirtinessChanged', (function(_this) {
      return function(e) {
        return _this.onSquadDirtinessChanged();
      };
    })(this)).on('xwing-backend:squadNameChanged', (function(_this) {
      return function(e) {
        return _this.onSquadNameChanged();
      };
    })(this)).on('xwing:beforeLanguageLoad', (function(_this) {
      return function(e, cb) {
        var old_dirty;
        if (cb == null) {
          cb = $.noop;
        }
        _this.pretranslation_serialized = _this.serialize();
        old_dirty = _this.current_squad.dirty;
        _this.removeAllShips();
        _this.current_squad.dirty = old_dirty;
        return cb();
      };
    })(this)).on('xwing:afterLanguageLoad', (function(_this) {
      return function(e, language, cb) {
        var old_dirty, ship, _i, _len, _ref;
        if (cb == null) {
          cb = $.noop;
        }
        _this.language = language;
        old_dirty = _this.current_squad.dirty;
        _this.loadFromSerialized(_this.pretranslation_serialized);
        _ref = _this.ships;
        for (_i = 0, _len = _ref.length; _i < _len; _i++) {
          ship = _ref[_i];
          ship.updateSelections();
        }
        _this.current_squad.dirty = old_dirty;
        _this.pretranslation_serialized = void 0;
        return cb();
      };
    })(this)).on('xwing:shipUpdated', (function(_this) {
      return function(e, cb) {
        var all_allocated, ship, _i, _len, _ref;
        if (cb == null) {
          cb = $.noop;
        }
        all_allocated = true;
        _ref = _this.ships;
        for (_i = 0, _len = _ref.length; _i < _len; _i++) {
          ship = _ref[_i];
          ship.updateSelections();
          if (ship.ship_selector.val() === '') {
            all_allocated = false;
          }
        }
        if (all_allocated && !_this.suppress_automatic_new_ship) {
          return _this.addShip();
        }
      };
    })(this));
    $(window).on('xwing-backend:authenticationChanged', (function(_this) {
      return function(e) {
        return _this.resetCurrentSquad();
      };
    })(this)).on('xwing-collection:created', (function(_this) {
      return function(e, collection) {
        _this.collection = collection;
        _this.collection.onLanguageChange(null, _this.language);
        _this.checkCollection();
        return _this.collection_button.removeClass('hidden');
      };
    })(this)).on('xwing-collection:changed', (function(_this) {
      return function(e, collection) {
        return _this.checkCollection();
      };
    })(this)).on('xwing-collection:destroyed', (function(_this) {
      return function(e, collection) {
        _this.collection = null;
        return _this.collection_button.addClass('hidden');
      };
    })(this)).on('xwing:pingActiveBuilder', (function(_this) {
      return function(e, cb) {
        if (_this.container.is(':visible')) {
          return cb(_this);
        }
      };
    })(this)).on('xwing:activateBuilder', (function(_this) {
      return function(e, faction, cb) {
        if (faction === _this.faction) {
          _this.tab.tab('show');
          return cb(_this);
        }
      };
    })(this));
    this.obstacles_select.change((function(_this) {
      return function(e) {
        var new_selection, o, previous_obstacles;
        if (_this.obstacles_select.val().length > 3) {
          return _this.obstacles_select.val(_this.current_squad.additional_data.obstacles);
        } else {
          previous_obstacles = _this.current_squad.additional_data.obstacles;
          _this.current_obstacles = (function() {
            var _i, _len, _ref, _results;
            _ref = this.obstacles_select.val();
            _results = [];
            for (_i = 0, _len = _ref.length; _i < _len; _i++) {
              o = _ref[_i];
              _results.push(o);
            }
            return _results;
          }).call(_this);
          if ((previous_obstacles != null)) {
            new_selection = _this.current_obstacles.filter(function(element) {
              return previous_obstacles.indexOf(element) === -1;
            });
          } else {
            new_selection = _this.current_obstacles;
          }
          if (new_selection.length > 0) {
            _this.showChooseObstaclesSelectImage(new_selection[0]);
          }
          _this.current_squad.additional_data.obstacles = _this.current_obstacles;
          _this.current_squad.dirty = true;
          return _this.container.trigger('xwing-backend:squadDirtinessChanged');
        }
      };
    })(this));
    this.view_list_button.click((function(_this) {
      return function(e) {
        e.preventDefault();
        return _this.showTextListModal();
      };
    })(this));
    this.print_list_button.click((function(_this) {
      return function(e) {
        var faction, query, ship, text, _i, _len, _ref;
        e.preventDefault();
        _this.printable_container.find('.printable-header').html(_this.list_modal.find('.modal-header').html());
        _this.printable_container.find('.printable-body').text('');
        switch (_this.list_display_mode) {
          case 'simple':
            _this.printable_container.find('.printable-body').html(_this.simple_container.html());
            break;
          default:
            _ref = _this.ships;
            for (_i = 0, _len = _ref.length; _i < _len; _i++) {
              ship = _ref[_i];
              if (ship.pilot != null) {
                _this.printable_container.find('.printable-body').append(ship.toHTML());
              }
            }
            _this.printable_container.find('.fancy-ship').toggleClass('tall', _this.list_modal.find('.toggle-vertical-space').prop('checked'));
            _this.printable_container.find('.printable-body').toggleClass('bw', !_this.list_modal.find('.toggle-color-print').prop('checked'));
            faction = (function() {
              switch (this.faction) {
                case 'Rebel Alliance':
                  return 'rebel';
                case 'Galactic Empire':
                  return 'empire';
                case 'Scum and Villainy':
                  return 'scum';
              }
            }).call(_this);
            _this.printable_container.find('.squad-faction').html("<i class=\"xwing-miniatures-font xwing-miniatures-font-" + faction + "\"></i>");
        }
        _this.printable_container.find('.printable-body').append($.trim("<div class=\"print-conditions\"></div>"));
        _this.printable_container.find('.printable-body .print-conditions').html(_this.condition_container.html());
        if ($.trim(_this.notes.val()) !== '') {
          _this.printable_container.find('.printable-body').append($.trim("<h5 class=\"print-notes\">Notes:</h5>\n<pre class=\"print-notes\"></pre>"));
          _this.printable_container.find('.printable-body pre.print-notes').text(_this.notes.val());
        }
        if (_this.list_modal.find('.toggle-obstacles').prop('checked')) {
          _this.printable_container.find('.printable-body').append($.trim("<div class=\"obstacles\">\n    <div>Mark the three obstacles you are using.</div>\n    <img class=\"obstacle-silhouettes\" src=\"images/xws-obstacles.png\" />\n    <div>Mark which damage deck you are using.</div>\n    <div><i class=\"fa fa-square-o\"></i>Original Core Set&nbsp;&nbsp&nbsp;<i class=\"fa fa-square-o\"></i>The Force Awakens Core Set</div>\n</div>"));
        }
        query = _this.getPermaLinkParams(['sn', 'obs']);
        if ((query != null) && _this.list_modal.find('.toggle-juggler-qrcode').prop('checked')) {
          _this.printable_container.find('.printable-body').append($.trim("<div class=\"qrcode-container\">\n    <div class=\"permalink-container\">\n        <div class=\"qrcode\"></div>\n        <div class=\"qrcode-text\">Scan to open this list in the builder</div>\n    </div>\n    <div class=\"juggler-container\">\n        <div class=\"qrcode\"></div>\n        <div class=\"qrcode-text\">TOs: Scan to load this squad into List Juggler</div>\n    </div>\n</div>"));
          text = "https://yasb-xws.herokuapp.com/juggler" + query;
          _this.printable_container.find('.juggler-container .qrcode').qrcode({
            render: 'div',
            ec: 'M',
            size: text.length < 144 ? 144 : 160,
            text: text
          });
          text = "https://geordanr.github.io/xwing/" + query;
          _this.printable_container.find('.permalink-container .qrcode').qrcode({
            render: 'div',
            ec: 'M',
            size: text.length < 144 ? 144 : 160,
            text: text
          });
        }
        return window.print();
      };
    })(this));
    $(window).resize((function(_this) {
      return function() {
        if ($(window).width() < 768 && _this.list_display_mode !== 'simple') {
          return _this.select_simple_view_button.click();
        }
      };
    })(this));
    this.notes.change(this.onNotesUpdated);
    return this.notes.on('keyup', this.onNotesUpdated);
  };

  SquadBuilder.prototype.getPermaLinkParams = function(ignored_params) {
    var k, params, v;
    if (ignored_params == null) {
      ignored_params = [];
    }
    params = {};
    if (__indexOf.call(ignored_params, 'f') < 0) {
      params.f = encodeURI(this.faction);
    }
    if (__indexOf.call(ignored_params, 'd') < 0) {
      params.d = encodeURI(this.serialize());
    }
    if (__indexOf.call(ignored_params, 'sn') < 0) {
      params.sn = encodeURIComponent(this.current_squad.name);
    }
    if (__indexOf.call(ignored_params, 'obs') < 0) {
      params.obs = encodeURI(this.current_squad.additional_data.obstacles || '');
    }
    return "?" + ((function() {
      var _results;
      _results = [];
      for (k in params) {
        v = params[k];
        _results.push("" + k + "=" + v);
      }
      return _results;
    })()).join("&");
  };

  SquadBuilder.prototype.getPermaLink = function(params) {
    if (params == null) {
      params = this.getPermaLinkParams();
    }
    return "" + URL_BASE + params;
  };

  SquadBuilder.prototype.updatePermaLink = function() {
    var next_params;
    if (!this.container.is(':visible')) {
      return;
    }
    next_params = this.getPermaLinkParams();
    if (window.location.search !== next_params) {
      return window.history.replaceState(next_params, '', this.getPermaLink(next_params));
    }
  };

  SquadBuilder.prototype.onNotesUpdated = function() {
    if (this.total_points > 0) {
      this.current_squad.dirty = true;
      return this.container.trigger('xwing-backend:squadDirtinessChanged');
    }
  };

  SquadBuilder.prototype.onGameTypeChanged = function(gametype, cb) {
    if (cb == null) {
      cb = $.noop;
    }
    switch (gametype) {
      case 'standard':
        this.isEpic = false;
        this.isCustom = false;
        this.desired_points_input.val(100);
        this.maxSmallShipsOfOneType = null;
        this.maxLargeShipsOfOneType = null;
        break;
      case 'epic':
        this.isEpic = true;
        this.isCustom = false;
        this.maxEpicPointsAllowed = 5;
        this.desired_points_input.val(300);
        this.maxSmallShipsOfOneType = 12;
        this.maxLargeShipsOfOneType = 6;
        break;
      case 'team-epic':
        this.isEpic = true;
        this.isCustom = false;
        this.maxEpicPointsAllowed = 3;
        this.desired_points_input.val(200);
        this.maxSmallShipsOfOneType = 8;
        this.maxLargeShipsOfOneType = 4;
        break;
      case 'custom':
        this.isEpic = false;
        this.isCustom = true;
        this.maxSmallShipsOfOneType = null;
        this.maxLargeShipsOfOneType = null;
    }
    this.max_epic_points_span.text(this.maxEpicPointsAllowed);
    return this.onPointsUpdated(cb);
  };

  SquadBuilder.prototype.onPointsUpdated = function(cb) {
    var bbcode_ships, conditions, conditions_set, count, epic_content_used, htmlview_ships, i, illegal_for_epic, points_left, ship, shipCountsByType, ship_data, ship_name, ship_uses_epic_content, ship_uses_unreleased_content, unreleased_content_used, upgrade, _i, _j, _k, _l, _len, _len1, _len2, _len3, _len4, _m, _name, _ref, _ref1, _ref2, _ref3, _ref4, _ref5;
    if (cb == null) {
      cb = $.noop;
    }
    this.total_points = 0;
    this.total_epic_points = 0;
    unreleased_content_used = false;
    epic_content_used = false;
    _ref = this.ships;
    for (i = _i = 0, _len = _ref.length; _i < _len; i = ++_i) {
      ship = _ref[i];
      ship.validate();
      this.total_points += ship.getPoints();
      this.total_epic_points += ship.getEpicPoints();
      ship_uses_unreleased_content = ship.checkUnreleasedContent();
      if (ship_uses_unreleased_content) {
        unreleased_content_used = ship_uses_unreleased_content;
      }
      ship_uses_epic_content = ship.checkEpicContent();
      if (ship_uses_epic_content) {
        epic_content_used = ship_uses_epic_content;
      }
    }
    this.total_points_span.text(this.total_points);
    points_left = parseInt(this.desired_points_input.val()) - this.total_points;
    this.points_remaining_span.text(points_left);
    this.points_remaining_container.toggleClass('red', points_left < 0);
    this.unreleased_content_used_container.toggleClass('hidden', !unreleased_content_used);
    this.epic_content_used_container.toggleClass('hidden', this.isEpic || !epic_content_used);
    this.illegal_epic_upgrades_container.toggleClass('hidden', true);
    this.too_many_small_ships_container.toggleClass('hidden', true);
    this.too_many_large_ships_container.toggleClass('hidden', true);
    this.total_epic_points_container.toggleClass('hidden', true);
    if (this.isEpic) {
      this.total_epic_points_container.toggleClass('hidden', false);
      this.total_epic_points_span.text(this.total_epic_points);
      this.total_epic_points_span.toggleClass('red', this.total_epic_points > this.maxEpicPointsAllowed);
      shipCountsByType = {};
      illegal_for_epic = false;
      _ref1 = this.ships;
      for (i = _j = 0, _len1 = _ref1.length; _j < _len1; i = ++_j) {
        ship = _ref1[i];
        if ((ship != null ? ship.data : void 0) != null) {
          if (shipCountsByType[_name = ship.data.name] == null) {
            shipCountsByType[_name] = 0;
          }
          shipCountsByType[ship.data.name] += 1;
          if (ship.data.huge != null) {
            _ref2 = ship.upgrades;
            for (_k = 0, _len2 = _ref2.length; _k < _len2; _k++) {
              upgrade = _ref2[_k];
              if ((upgrade != null ? (_ref3 = upgrade.data) != null ? _ref3.epic_restriction_func : void 0 : void 0) != null) {
                if (!upgrade.data.epic_restriction_func(ship.data, upgrade)) {
                  illegal_for_epic = true;
                  break;
                }
              }
              if (illegal_for_epic) {
                break;
              }
            }
          }
        }
      }
      this.illegal_epic_upgrades_container.toggleClass('hidden', !illegal_for_epic);
      if ((this.maxLargeShipsOfOneType != null) && (this.maxSmallShipsOfOneType != null)) {
        for (ship_name in shipCountsByType) {
          count = shipCountsByType[ship_name];
          ship_data = exportObj.ships[ship_name];
          if ((ship_data.large != null) && count > this.maxLargeShipsOfOneType) {
            this.too_many_large_ships_container.toggleClass('hidden', false);
          } else if ((ship.huge == null) && count > this.maxSmallShipsOfOneType) {
            this.too_many_small_ships_container.toggleClass('hidden', false);
          }
        }
      }
    }
    this.fancy_total_points_container.text(this.total_points);
    this.fancy_container.text('');
    this.simple_container.html('<table class="simple-table"></table>');
    bbcode_ships = [];
    htmlview_ships = [];
    _ref4 = this.ships;
    for (_l = 0, _len3 = _ref4.length; _l < _len3; _l++) {
      ship = _ref4[_l];
      if (ship.pilot != null) {
        this.fancy_container.append(ship.toHTML());
        this.simple_container.find('table').append(ship.toTableRow());
        bbcode_ships.push(ship.toBBCode());
        htmlview_ships.push(ship.toSimpleHTML());
      }
    }
    this.htmlview_container.find('textarea').val($.trim("" + (htmlview_ships.join('<br />')) + "\n<br />\n<b><i>Total: " + this.total_points + "</i></b>\n<br />\n<a href=\"" + (this.getPermaLink()) + "\">View in Yet Another Squad Builder</a>"));
    this.bbcode_container.find('textarea').val($.trim("" + (bbcode_ships.join("\n\n")) + "\n\n[b][i]Total: " + this.total_points + "[/i][/b]\n\n[url=" + (this.getPermaLink()) + "]View in Yet Another Squad Builder[/url]"));
    this.checkCollection();
    if (typeof Set !== "undefined" && Set !== null) {
      conditions_set = new Set();
      _ref5 = this.ships;
      for (_m = 0, _len4 = _ref5.length; _m < _len4; _m++) {
        ship = _ref5[_m];
        ship.getConditions().forEach(function(condition) {
          return conditions_set.add(condition);
        });
      }
      conditions = [];
      conditions_set.forEach(function(condition) {
        return conditions.push(condition);
      });
      conditions.sort(function(a, b) {
        if (a.name.canonicalize() < b.name.canonicalize()) {
          return -1;
        } else if (b.name.canonicalize() > a.name.canonicalize()) {
          return 1;
        } else {
          return 0;
        }
      });
      this.condition_container.text('');
      conditions.forEach((function(_this) {
        return function(condition) {
          return _this.condition_container.append(conditionToHTML(condition));
        };
      })(this));
    }
    return cb(this.total_points);
  };

  SquadBuilder.prototype.onSquadLoadRequested = function(squad) {
    var _ref;
    console.log(squad.additional_data.obstacles);
    this.current_squad = squad;
    this.backend_delete_list_button.removeClass('disabled');
    this.squad_name_input.val(this.current_squad.name);
    this.squad_name_placeholder.text(this.current_squad.name);
    this.current_obstacles = this.current_squad.additional_data.obstacles;
    this.updateObstacleSelect(this.current_squad.additional_data.obstacles);
    this.loadFromSerialized(squad.serialized);
    this.notes.val((_ref = squad.additional_data.notes) != null ? _ref : '');
    this.backend_status.fadeOut('slow');
    this.current_squad.dirty = false;
    return this.container.trigger('xwing-backend:squadDirtinessChanged');
  };

  SquadBuilder.prototype.onSquadDirtinessChanged = function() {
    this.backend_save_list_button.toggleClass('disabled', !(this.current_squad.dirty && this.total_points > 0));
    this.backend_save_list_as_button.toggleClass('disabled', this.total_points === 0);
    return this.backend_delete_list_button.toggleClass('disabled', this.current_squad.id == null);
  };

  SquadBuilder.prototype.onSquadNameChanged = function() {
    var short_name;
    if (this.current_squad.name.length > SQUAD_DISPLAY_NAME_MAX_LENGTH) {
      short_name = "" + (this.current_squad.name.substr(0, SQUAD_DISPLAY_NAME_MAX_LENGTH)) + "&hellip;";
    } else {
      short_name = this.current_squad.name;
    }
    this.squad_name_placeholder.text('');
    this.squad_name_placeholder.append(short_name);
    return this.squad_name_input.val(this.current_squad.name);
  };

  SquadBuilder.prototype.removeAllShips = function() {
    while (this.ships.length > 0) {
      this.removeShip(this.ships[0]);
    }
    if (this.ships.length > 0) {
      throw new Error("Ships not emptied");
    }
  };

  SquadBuilder.prototype.showTextListModal = function() {
    return this.list_modal.modal('show');
  };

  SquadBuilder.prototype.showChooseObstaclesModal = function() {
    this.obstacles_select.val(this.current_squad.additional_data.obstacles);
    return this.choose_obstacles_modal.modal('show');
  };

  SquadBuilder.prototype.showChooseObstaclesSelectImage = function(obstacle) {
    this.image_name = 'images/' + obstacle + '.png';
    this.obstacles_select_image.find('.obstacle-image').attr('src', this.image_name);
    return this.obstacles_select_image.show();
  };

  SquadBuilder.prototype.updateObstacleSelect = function(obstacles) {
    this.current_obstacles = obstacles;
    return this.obstacles_select.val(obstacles);
  };

  SquadBuilder.prototype.serialize = function() {
    var game_type_abbrev, serialization_version, ship;
    serialization_version = 4;
    game_type_abbrev = (function() {
      switch (this.game_type_selector.val()) {
        case 'standard':
          return 's';
        case 'epic':
          return 'e';
        case 'team-epic':
          return 't';
        case 'custom':
          return "c=" + ($.trim(this.desired_points_input.val()));
      }
    }).call(this);
    return "v" + serialization_version + "!" + game_type_abbrev + "!" + (((function() {
      var _i, _len, _ref, _results;
      _ref = this.ships;
      _results = [];
      for (_i = 0, _len = _ref.length; _i < _len; _i++) {
        ship = _ref[_i];
        if (ship.pilot != null) {
          _results.push(ship.toSerialized());
        }
      }
      return _results;
    }).call(this)).join(';'));
  };

  SquadBuilder.prototype.loadFromSerialized = function(serialized) {
    var game_type_abbrev, matches, new_ship, re, serialized_ship, serialized_ships, version, _i, _j, _k, _len, _len1, _len2, _ref, _ref1, _ref2, _ref3;
    this.suppress_automatic_new_ship = true;
    this.removeAllShips();
    re = /^v(\d+)!(.*)/;
    matches = re.exec(serialized);
    if (matches != null) {
      version = parseInt(matches[1]);
      switch (version) {
        case 3:
        case 4:
          _ref = matches[2].split('!'), game_type_abbrev = _ref[0], serialized_ships = _ref[1];
          switch (game_type_abbrev) {
            case 's':
              this.game_type_selector.val('standard');
              this.game_type_selector.change();
              break;
            case 'e':
              this.game_type_selector.val('epic');
              this.game_type_selector.change();
              break;
            case 't':
              this.game_type_selector.val('team-epic');
              this.game_type_selector.change();
              break;
            default:
              this.game_type_selector.val('custom');
              this.desired_points_input.val(parseInt(game_type_abbrev.split('=')[1]));
              this.desired_points_input.change();
          }
          _ref1 = serialized_ships.split(';');
          for (_i = 0, _len = _ref1.length; _i < _len; _i++) {
            serialized_ship = _ref1[_i];
            if (serialized_ship !== '') {
              new_ship = this.addShip();
              new_ship.fromSerialized(version, serialized_ship);
            }
          }
          break;
        case 2:
          _ref2 = matches[2].split(';');
          for (_j = 0, _len1 = _ref2.length; _j < _len1; _j++) {
            serialized_ship = _ref2[_j];
            if (serialized_ship !== '') {
              new_ship = this.addShip();
              new_ship.fromSerialized(version, serialized_ship);
            }
          }
      }
    } else {
      _ref3 = serialized.split(';');
      for (_k = 0, _len2 = _ref3.length; _k < _len2; _k++) {
        serialized_ship = _ref3[_k];
        if (serialized !== '') {
          new_ship = this.addShip();
          new_ship.fromSerialized(1, serialized_ship);
        }
      }
    }
    this.suppress_automatic_new_ship = false;
    return this.addShip();
  };

  SquadBuilder.prototype.uniqueIndex = function(unique, type) {
    if (!(type in this.uniques_in_use)) {
      throw new Error("Invalid unique type '" + type + "'");
    }
    return this.uniques_in_use[type].indexOf(unique);
  };

  SquadBuilder.prototype.claimUnique = function(unique, type, cb) {
    var bycanonical, canonical, other, otherslot, _i, _len, _ref, _ref1;
    if (this.uniqueIndex(unique, type) < 0) {
      _ref = exportObj.pilotsByUniqueName[unique.canonical_name.getXWSBaseName()] || [];
      for (_i = 0, _len = _ref.length; _i < _len; _i++) {
        other = _ref[_i];
        if (unique !== other) {
          if (this.uniqueIndex(other, 'Pilot') < 0) {
            this.uniques_in_use['Pilot'].push(other);
          } else {
            throw new Error("Unique " + type + " '" + unique.name + "' already claimed as pilot");
          }
        }
      }
      _ref1 = exportObj.upgradesBySlotUniqueName;
      for (otherslot in _ref1) {
        bycanonical = _ref1[otherslot];
        for (canonical in bycanonical) {
          other = bycanonical[canonical];
          if (canonical.getXWSBaseName() === unique.canonical_name.getXWSBaseName() && unique !== other) {
            if (this.uniqueIndex(other, 'Upgrade') < 0) {
              this.uniques_in_use['Upgrade'].push(other);
            }
          }
        }
      }
      this.uniques_in_use[type].push(unique);
    } else {
      throw new Error("Unique " + type + " '" + unique.name + "' already claimed");
    }
    return cb();
  };

  SquadBuilder.prototype.releaseUnique = function(unique, type, cb) {
    var idx, u, uniques, _i, _len, _ref;
    idx = this.uniqueIndex(unique, type);
    if (idx >= 0) {
      _ref = this.uniques_in_use;
      for (type in _ref) {
        uniques = _ref[type];
        this.uniques_in_use[type] = [];
        for (_i = 0, _len = uniques.length; _i < _len; _i++) {
          u = uniques[_i];
          if (u.canonical_name.getXWSBaseName() !== unique.canonical_name.getXWSBaseName()) {
            this.uniques_in_use[type].push(u);
          }
        }
      }
    } else {
      throw new Error("Unique " + type + " '" + unique.name + "' not in use");
    }
    return cb();
  };

  SquadBuilder.prototype.addShip = function() {
    var new_ship;
    new_ship = new Ship({
      builder: this,
      container: this.ship_container
    });
    this.ships.push(new_ship);
    return new_ship;
  };

  SquadBuilder.prototype.removeShip = function(ship) {
    var ___iced_passed_deferral, __iced_deferrals, __iced_k;
    __iced_k = __iced_k_noop;
    ___iced_passed_deferral = iced.findDeferral(arguments);
    (function(_this) {
      return (function(__iced_k) {
        __iced_deferrals = new iced.Deferrals(__iced_k, {
          parent: ___iced_passed_deferral,
          funcname: "SquadBuilder.removeShip"
        });
        ship.destroy(__iced_deferrals.defer({
          lineno: 19035
        }));
        __iced_deferrals._fulfill();
      });
    })(this)((function(_this) {
      return function() {
        (function(__iced_k) {
          __iced_deferrals = new iced.Deferrals(__iced_k, {
            parent: ___iced_passed_deferral,
            funcname: "SquadBuilder.removeShip"
          });
          _this.container.trigger('xwing:pointsUpdated', __iced_deferrals.defer({
            lineno: 19036
          }));
          __iced_deferrals._fulfill();
        })(function() {
          _this.current_squad.dirty = true;
          return _this.container.trigger('xwing-backend:squadDirtinessChanged');
        });
      };
    })(this));
  };

  SquadBuilder.prototype.matcher = function(item, term) {
    return item.toUpperCase().indexOf(term.toUpperCase()) >= 0;
  };

  SquadBuilder.prototype.isOurFaction = function(faction) {
    var f, _i, _len;
    if (faction instanceof Array) {
      for (_i = 0, _len = faction.length; _i < _len; _i++) {
        f = faction[_i];
        if (getPrimaryFaction(f) === this.faction) {
          return true;
        }
      }
      return false;
    } else {
      return getPrimaryFaction(faction) === this.faction;
    }
  };

  SquadBuilder.prototype.getAvailableShipsMatching = function(term) {
    var ship_data, ship_name, ships, _ref;
    if (term == null) {
      term = '';
    }
    ships = [];
    _ref = exportObj.ships;
    for (ship_name in _ref) {
      ship_data = _ref[ship_name];
      if (this.isOurFaction(ship_data.factions) && this.matcher(ship_data.name, term)) {
        if (!ship_data.huge || (this.isEpic || this.isCustom)) {
          ships.push({
            id: ship_data.name,
            text: ship_data.name,
            english_name: ship_data.english_name,
            canonical_name: ship_data.canonical_name
          });
        }
      }
    }
    return ships.sort(exportObj.sortHelper);
  };

  SquadBuilder.prototype.getAvailablePilotsForShipIncluding = function(ship, include_pilot, term) {
    var available_faction_pilots, eligible_faction_pilots, pilot, pilot_name;
    if (term == null) {
      term = '';
    }
    available_faction_pilots = (function() {
      var _ref, _results;
      _ref = exportObj.pilotsByLocalizedName;
      _results = [];
      for (pilot_name in _ref) {
        pilot = _ref[pilot_name];
        if (((ship == null) || pilot.ship === ship) && this.isOurFaction(pilot.faction) && this.matcher(pilot_name, term)) {
          _results.push(pilot);
        }
      }
      return _results;
    }).call(this);
    eligible_faction_pilots = (function() {
      var _results;
      _results = [];
      for (pilot_name in available_faction_pilots) {
        pilot = available_faction_pilots[pilot_name];
        if ((pilot.unique == null) || __indexOf.call(this.uniques_in_use['Pilot'], pilot) < 0 || pilot.canonical_name.getXWSBaseName() === (include_pilot != null ? include_pilot.canonical_name.getXWSBaseName() : void 0)) {
          _results.push(pilot);
        }
      }
      return _results;
    }).call(this);
    if ((include_pilot != null) && (include_pilot.unique != null) && this.matcher(include_pilot.name, term)) {
      eligible_faction_pilots.push(include_pilot);
    }
    return ((function() {
      var _i, _len, _results;
      _results = [];
      for (_i = 0, _len = available_faction_pilots.length; _i < _len; _i++) {
        pilot = available_faction_pilots[_i];
        _results.push({
          id: pilot.id,
          text: "" + pilot.name + " (" + pilot.points + ")",
          points: pilot.points,
          ship: pilot.ship,
          english_name: pilot.english_name,
          disabled: __indexOf.call(eligible_faction_pilots, pilot) < 0
        });
      }
      return _results;
    })()).sort(exportObj.sortHelper);
  };

  dfl_filter_func = function() {
    return true;
  };

  SquadBuilder.prototype.getAvailableUpgradesIncluding = function(slot, include_upgrade, ship, this_upgrade_obj, term, filter_func) {
    var available_upgrades, eligible_upgrades, equipped_upgrade, limited_upgrades_in_use, m, retval, title, upgrade, upgrade_name, _i, _j, _k, _len, _len1, _len2, _ref, _ref1, _ref2, _ref3, _ref4, _results;
    if (term == null) {
      term = '';
    }
    if (filter_func == null) {
      filter_func = this.dfl_filter_func;
    }
    limited_upgrades_in_use = (function() {
      var _i, _len, _ref, _ref1, _results;
      _ref = ship.upgrades;
      _results = [];
      for (_i = 0, _len = _ref.length; _i < _len; _i++) {
        upgrade = _ref[_i];
        if ((upgrade != null ? (_ref1 = upgrade.data) != null ? _ref1.limited : void 0 : void 0) != null) {
          _results.push(upgrade.data);
        }
      }
      return _results;
    })();
    available_upgrades = (function() {
      var _ref, _results;
      _ref = exportObj.upgradesByLocalizedName;
      _results = [];
      for (upgrade_name in _ref) {
        upgrade = _ref[upgrade_name];
        if (upgrade.slot === slot && this.matcher(upgrade_name, term) && ((upgrade.ship == null) || upgrade.ship === ship.data.name) && ((upgrade.faction == null) || this.isOurFaction(upgrade.faction)) && ((this.isEpic || this.isCustom) || upgrade.restriction_func !== exportObj.hugeOnly)) {
          _results.push(upgrade);
        }
      }
      return _results;
    }).call(this);
    if (filter_func !== this.dfl_filter_func) {
      available_upgrades = (function() {
        var _i, _len, _results;
        _results = [];
        for (_i = 0, _len = available_upgrades.length; _i < _len; _i++) {
          upgrade = available_upgrades[_i];
          if (filter_func(upgrade)) {
            _results.push(upgrade);
          }
        }
        return _results;
      })();
    }
    if ((this.isEpic || this.isCustom) && slot === 'Hardpoint' && (_ref = 'Ordnance Tubes'.canonicalize(), __indexOf.call((function() {
      var _i, _len, _ref1, _results;
      _ref1 = ship.modifications;
      _results = [];
      for (_i = 0, _len = _ref1.length; _i < _len; _i++) {
        m = _ref1[_i];
        if (m.data != null) {
          _results.push(m.data.canonical_name.getXWSBaseName());
        }
      }
      return _results;
    })(), _ref) >= 0)) {
      available_upgrades = available_upgrades.concat((function() {
        var _ref1, _ref2, _results;
        _ref1 = exportObj.upgradesByLocalizedName;
        _results = [];
        for (upgrade_name in _ref1) {
          upgrade = _ref1[upgrade_name];
          if (((_ref2 = upgrade.slot) === 'Missile' || _ref2 === 'Torpedo') && this.matcher(upgrade_name, term) && ((upgrade.ship == null) || upgrade.ship === ship.data.name) && ((upgrade.faction == null) || this.isOurFaction(upgrade.faction)) && ((this.isEpic || this.isCustom) || upgrade.restriction_func !== exportObj.hugeOnly)) {
            _results.push(upgrade);
          }
        }
        return _results;
      }).call(this));
    }
    eligible_upgrades = (function() {
      var _results;
      _results = [];
      for (upgrade_name in available_upgrades) {
        upgrade = available_upgrades[upgrade_name];
        if (((upgrade.unique == null) || __indexOf.call(this.uniques_in_use['Upgrade'], upgrade) < 0) && (!((ship != null) && (upgrade.restriction_func != null)) || upgrade.restriction_func(ship, this_upgrade_obj)) && __indexOf.call(limited_upgrades_in_use, upgrade) < 0) {
          _results.push(upgrade);
        }
      }
      return _results;
    }).call(this);
    _ref2 = (_ref1 = ship != null ? ship.titles : void 0) != null ? _ref1 : [];
    for (_i = 0, _len = _ref2.length; _i < _len; _i++) {
      title = _ref2[_i];
      if ((title != null ? (_ref3 = title.data) != null ? _ref3.special_case : void 0 : void 0) === 'A-Wing Test Pilot') {
        _ref4 = (function() {
          var _k, _len1, _ref4, _results;
          _ref4 = ship.upgrades;
          _results = [];
          for (_k = 0, _len1 = _ref4.length; _k < _len1; _k++) {
            upgrade = _ref4[_k];
            if ((upgrade != null ? upgrade.data : void 0) != null) {
              _results.push(upgrade.data);
            }
          }
          return _results;
        })();
        for (_j = 0, _len1 = _ref4.length; _j < _len1; _j++) {
          equipped_upgrade = _ref4[_j];
          eligible_upgrades.removeItem(equipped_upgrade);
        }
      }
    }
    if ((include_upgrade != null) && (((include_upgrade.unique != null) || (include_upgrade.limited != null)) && this.matcher(include_upgrade.name, term))) {
      eligible_upgrades.push(include_upgrade);
    }
    retval = ((function() {
      var _k, _len2, _results;
      _results = [];
      for (_k = 0, _len2 = available_upgrades.length; _k < _len2; _k++) {
        upgrade = available_upgrades[_k];
        _results.push({
          id: upgrade.id,
          text: "" + upgrade.name + " (" + upgrade.points + ")",
          points: upgrade.points,
          english_name: upgrade.english_name,
          disabled: __indexOf.call(eligible_upgrades, upgrade) < 0
        });
      }
      return _results;
    })()).sort(exportObj.sortHelper);
    if (this_upgrade_obj.adjustment_func != null) {
      _results = [];
      for (_k = 0, _len2 = retval.length; _k < _len2; _k++) {
        upgrade = retval[_k];
        _results.push(this_upgrade_obj.adjustment_func(upgrade));
      }
      return _results;
    } else {
      return retval;
    }
  };

  SquadBuilder.prototype.getAvailableModificationsIncluding = function(include_modification, ship, term, filter_func) {
    var available_modifications, eligible_modifications, equipped_modification, limited_modifications_in_use, modification, modification_name, title, _i, _j, _len, _len1, _ref, _ref1, _ref2, _ref3;
    if (term == null) {
      term = '';
    }
    if (filter_func == null) {
      filter_func = this.dfl_filter_func;
    }
    limited_modifications_in_use = (function() {
      var _i, _len, _ref, _ref1, _results;
      _ref = ship.modifications;
      _results = [];
      for (_i = 0, _len = _ref.length; _i < _len; _i++) {
        modification = _ref[_i];
        if ((modification != null ? (_ref1 = modification.data) != null ? _ref1.limited : void 0 : void 0) != null) {
          _results.push(modification.data);
        }
      }
      return _results;
    })();
    available_modifications = (function() {
      var _ref, _results;
      _ref = exportObj.modificationsByLocalizedName;
      _results = [];
      for (modification_name in _ref) {
        modification = _ref[modification_name];
        if (this.matcher(modification_name, term) && ((modification.ship == null) || modification.ship === ship.data.name)) {
          _results.push(modification);
        }
      }
      return _results;
    }).call(this);
    if (filter_func !== this.dfl_filter_func) {
      available_modifications = (function() {
        var _i, _len, _results;
        _results = [];
        for (_i = 0, _len = available_modifications.length; _i < _len; _i++) {
          modification = available_modifications[_i];
          if (filter_func(modification)) {
            _results.push(modification);
          }
        }
        return _results;
      })();
    }
    if ((ship != null) && exportObj.hugeOnly(ship) > 0) {
      available_modifications = (function() {
        var _i, _len, _results;
        _results = [];
        for (_i = 0, _len = available_modifications.length; _i < _len; _i++) {
          modification = available_modifications[_i];
          if ((modification.ship != null) || (modification.restriction_func == null) || modification.restriction_func(ship)) {
            _results.push(modification);
          }
        }
        return _results;
      })();
    }
    eligible_modifications = (function() {
      var _results;
      _results = [];
      for (modification_name in available_modifications) {
        modification = available_modifications[modification_name];
        if (((modification.unique == null) || __indexOf.call(this.uniques_in_use['Modification'], modification) < 0) && ((modification.faction == null) || this.isOurFaction(modification.faction)) && (!((ship != null) && (modification.restriction_func != null)) || modification.restriction_func(ship)) && __indexOf.call(limited_modifications_in_use, modification) < 0) {
          _results.push(modification);
        }
      }
      return _results;
    }).call(this);
    _ref1 = (_ref = ship != null ? ship.titles : void 0) != null ? _ref : [];
    for (_i = 0, _len = _ref1.length; _i < _len; _i++) {
      title = _ref1[_i];
      if ((title != null ? (_ref2 = title.data) != null ? _ref2.special_case : void 0 : void 0) === 'Royal Guard TIE') {
        _ref3 = (function() {
          var _k, _len1, _ref3, _results;
          _ref3 = ship.modifications;
          _results = [];
          for (_k = 0, _len1 = _ref3.length; _k < _len1; _k++) {
            modification = _ref3[_k];
            if ((modification != null ? modification.data : void 0) != null) {
              _results.push(modificationsById[modification.data.id]);
            }
          }
          return _results;
        })();
        for (_j = 0, _len1 = _ref3.length; _j < _len1; _j++) {
          equipped_modification = _ref3[_j];
          eligible_modifications.removeItem(equipped_modification);
        }
      }
    }
    if ((include_modification != null) && (((include_modification.unique != null) || (include_modification.limited != null)) && this.matcher(include_modification.name, term))) {
      eligible_modifications.push(include_modification);
    }
    return ((function() {
      var _k, _len2, _results;
      _results = [];
      for (_k = 0, _len2 = available_modifications.length; _k < _len2; _k++) {
        modification = available_modifications[_k];
        _results.push({
          id: modification.id,
          text: "" + modification.name + " (" + modification.points + ")",
          points: modification.points,
          english_name: modification.english_name,
          disabled: __indexOf.call(eligible_modifications, modification) < 0
        });
      }
      return _results;
    })()).sort(exportObj.sortHelper);
  };

  SquadBuilder.prototype.getAvailableTitlesIncluding = function(ship, include_title, term) {
    var available_titles, eligible_titles, limited_titles_in_use, t, title, title_name;
    if (term == null) {
      term = '';
    }
    limited_titles_in_use = (function() {
      var _i, _len, _ref, _ref1, _results;
      _ref = ship.titles;
      _results = [];
      for (_i = 0, _len = _ref.length; _i < _len; _i++) {
        title = _ref[_i];
        if ((title != null ? (_ref1 = title.data) != null ? _ref1.limited : void 0 : void 0) != null) {
          _results.push(title.data);
        }
      }
      return _results;
    })();
    available_titles = (function() {
      var _ref, _results;
      _ref = exportObj.titlesByLocalizedName;
      _results = [];
      for (title_name in _ref) {
        title = _ref[title_name];
        if (((title.ship == null) || title.ship === ship.data.name) && this.matcher(title_name, term)) {
          _results.push(title);
        }
      }
      return _results;
    }).call(this);
    eligible_titles = (function() {
      var _ref, _results;
      _results = [];
      for (title_name in available_titles) {
        title = available_titles[title_name];
        if (((title.unique == null) || (__indexOf.call(this.uniques_in_use['Title'], title) < 0 && (_ref = title.canonical_name.getXWSBaseName(), __indexOf.call((function() {
          var _i, _len, _ref1, _results1;
          _ref1 = this.uniques_in_use['Title'];
          _results1 = [];
          for (_i = 0, _len = _ref1.length; _i < _len; _i++) {
            t = _ref1[_i];
            _results1.push(t.canonical_name.getXWSBaseName());
          }
          return _results1;
        }).call(this), _ref) < 0)) || title.canonical_name.getXWSBaseName() === (include_title != null ? include_title.canonical_name.getXWSBaseName() : void 0)) && ((title.faction == null) || this.isOurFaction(title.faction)) && (!((ship != null) && (title.restriction_func != null)) || title.restriction_func(ship)) && __indexOf.call(limited_titles_in_use, title) < 0) {
          _results.push(title);
        }
      }
      return _results;
    }).call(this);
    if ((include_title != null) && (((include_title.unique != null) || (include_title.limited != null)) && this.matcher(include_title.name, term))) {
      eligible_titles.push(include_title);
    }
    return ((function() {
      var _i, _len, _results;
      _results = [];
      for (_i = 0, _len = available_titles.length; _i < _len; _i++) {
        title = available_titles[_i];
        _results.push({
          id: title.id,
          text: "" + title.name + " (" + title.points + ")",
          points: title.points,
          english_name: title.english_name,
          disabled: __indexOf.call(eligible_titles, title) < 0
        });
      }
      return _results;
    })()).sort(exportObj.sortHelper);
  };

  SquadBuilder.prototype.getManeuverTableHTML = function(maneuvers, baseManeuvers) {
    var bearing, bearings, bearings_without_maneuvers, className, color, difficulty, haveManeuver, linePath, outTable, outlineColor, speed, transform, trianglePath, turn, v, _i, _j, _k, _l, _len, _len1, _len2, _m, _n, _ref, _ref1, _ref2, _ref3, _results;
    if ((maneuvers == null) || maneuvers.length === 0) {
      return "Missing maneuver info.";
    }
    bearings_without_maneuvers = (function() {
      _results = [];
      for (var _i = 0, _ref = maneuvers[0].length; 0 <= _ref ? _i < _ref : _i > _ref; 0 <= _ref ? _i++ : _i--){ _results.push(_i); }
      return _results;
    }).apply(this);
    for (_j = 0, _len = maneuvers.length; _j < _len; _j++) {
      bearings = maneuvers[_j];
      for (bearing = _k = 0, _len1 = bearings.length; _k < _len1; bearing = ++_k) {
        difficulty = bearings[bearing];
        if (difficulty > 0) {
          bearings_without_maneuvers.removeItem(bearing);
        }
      }
    }
    outTable = "<table><tbody>";
    for (speed = _l = _ref1 = maneuvers.length - 1; _ref1 <= 0 ? _l <= 0 : _l >= 0; speed = _ref1 <= 0 ? ++_l : --_l) {
      haveManeuver = false;
      _ref2 = maneuvers[speed];
      for (_m = 0, _len2 = _ref2.length; _m < _len2; _m++) {
        v = _ref2[_m];
        if (v > 0) {
          haveManeuver = true;
          break;
        }
      }
      if (!haveManeuver) {
        continue;
      }
      outTable += "<tr><td>" + speed + "</td>";
      for (turn = _n = 0, _ref3 = maneuvers[speed].length; 0 <= _ref3 ? _n < _ref3 : _n > _ref3; turn = 0 <= _ref3 ? ++_n : --_n) {
        if (__indexOf.call(bearings_without_maneuvers, turn) >= 0) {
          continue;
        }
        outTable += "<td>";
        if (maneuvers[speed][turn] > 0) {
          color = (function() {
            switch (maneuvers[speed][turn]) {
              case 1:
                return "white";
              case 2:
                return "green";
              case 3:
                return "red";
            }
          })();
          outTable += "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"30px\" height=\"30px\" viewBox=\"0 0 200 200\">";
          if (speed === 0) {
            outTable += "<rect x=\"50\" y=\"50\" width=\"100\" height=\"100\" style=\"fill:" + color + "\" />";
          } else {
            outlineColor = "black";
            if (maneuvers[speed][turn] !== baseManeuvers[speed][turn]) {
              outlineColor = "gold";
            }
            transform = "";
            className = "";
            switch (turn) {
              case 0:
                linePath = "M160,180 L160,70 80,70";
                trianglePath = "M80,100 V40 L30,70 Z";
                break;
              case 1:
                linePath = "M150,180 S150,120 80,60";
                trianglePath = "M80,100 V40 L30,70 Z";
                transform = "transform='translate(-5 -15) rotate(45 70 90)' ";
                break;
              case 2:
                linePath = "M100,180 L100,100 100,80";
                trianglePath = "M70,80 H130 L100,30 Z";
                break;
              case 3:
                linePath = "M50,180 S50,120 120,60";
                trianglePath = "M120,100 V40 L170,70 Z";
                transform = "transform='translate(5 -15) rotate(-45 130 90)' ";
                break;
              case 4:
                linePath = "M40,180 L40,70 120,70";
                trianglePath = "M120,100 V40 L170,70 Z";
                break;
              case 5:
                linePath = "M50,180 L50,100 C50,10 140,10 140,100 L140,120";
                trianglePath = "M170,120 H110 L140,180 Z";
                break;
              case 6:
                linePath = "M150,180 S150,120 80,60";
                trianglePath = "M80,100 V40 L30,70 Z";
                transform = "transform='translate(0 50)'";
                break;
              case 7:
                linePath = "M50,180 S50,120 120,60";
                trianglePath = "M120,100 V40 L170,70 Z";
                transform = "transform='translate(0 50)'";
                break;
              case 8:
                linePath = "M160,180 L160,70 80,70";
                trianglePath = "M60,100 H100 L80,140 Z";
                break;
              case 9:
                linePath = "M40,180 L40,70 120,70";
                trianglePath = "M100,100 H140 L120,140 Z";
                break;
              case 10:
                linePath = "M50,180 S50,120 120,60";
                trianglePath = "M120,100 V40 L170,70 Z";
                transform = "transform='translate(5 -15) rotate(-45 130 90)' ";
                className = 'backwards';
                break;
              case 11:
                linePath = "M100,180 L100,100 100,80";
                trianglePath = "M70,80 H130 L100,30 Z";
                className = 'backwards';
                break;
              case 12:
                linePath = "M150,180 S150,120 80,60";
                trianglePath = "M80,100 V40 L30,70 Z";
                transform = "transform='translate(-5 -15) rotate(45 70 90)' ";
                className = 'backwards';
            }
            outTable += $.trim("<g class=\"maneuver " + className + "\">\n  <path d='" + trianglePath + "' fill='" + color + "' stroke-width='5' stroke='" + outlineColor + "' " + transform + "/>\n  <path stroke-width='25' fill='none' stroke='" + outlineColor + "' d='" + linePath + "' />\n  <path stroke-width='15' fill='none' stroke='" + color + "' d='" + linePath + "' />\n</g>");
          }
          outTable += "</svg>";
        }
        outTable += "</td>";
      }
      outTable += "</tr>";
    }
    outTable += "</tbody></table>";
    return outTable;
  };

  SquadBuilder.prototype.showTooltip = function(type, data, additional_opts) {
    var a, action, addon_count, cls, effective_stats, extra_actions, pilot_count, ship, ship_count, slot, source, _i, _j, _k, _len, _len1, _len2, _ref, _ref1, _ref10, _ref11, _ref12, _ref13, _ref14, _ref15, _ref16, _ref17, _ref18, _ref19, _ref2, _ref20, _ref21, _ref22, _ref23, _ref24, _ref25, _ref26, _ref27, _ref28, _ref29, _ref3, _ref30, _ref31, _ref32, _ref33, _ref34, _ref35, _ref36, _ref37, _ref38, _ref39, _ref4, _ref40, _ref41, _ref42, _ref43, _ref44, _ref45, _ref46, _ref47, _ref48, _ref5, _ref6, _ref7, _ref8, _ref9;
    if (data !== this.tooltip_currently_displaying) {
      switch (type) {
        case 'Ship':
          this.info_container.find('.info-sources').text(((function() {
            var _i, _len, _ref, _results;
            _ref = data.pilot.sources;
            _results = [];
            for (_i = 0, _len = _ref.length; _i < _len; _i++) {
              source = _ref[_i];
              _results.push(exportObj.translate(this.language, 'sources', source));
            }
            return _results;
          }).call(this)).sort().join(', '));
          if (((_ref = this.collection) != null ? _ref.counts : void 0) != null) {
            ship_count = (_ref1 = (_ref2 = this.collection.counts) != null ? (_ref3 = _ref2.ship) != null ? _ref3[data.data.english_name] : void 0 : void 0) != null ? _ref1 : 0;
            pilot_count = (_ref4 = (_ref5 = this.collection.counts) != null ? (_ref6 = _ref5.pilot) != null ? _ref6[data.pilot.english_name] : void 0 : void 0) != null ? _ref4 : 0;
            this.info_container.find('.info-collection').text("You have " + ship_count + " ship model" + (ship_count > 1 ? 's' : '') + " and " + pilot_count + " pilot card" + (pilot_count > 1 ? 's' : '') + " in your collection.");
          } else {
            this.info_container.find('.info-collection').text('');
          }
          effective_stats = data.effectiveStats();
          extra_actions = $.grep(effective_stats.actions, function(el, i) {
            return __indexOf.call(data.data.actions, el) < 0;
          });
          this.info_container.find('.info-name').html("" + (data.pilot.unique ? "&middot;&nbsp;" : "") + data.pilot.name + (data.pilot.epic != null ? " (" + (exportObj.translate(this.language, 'ui', 'epic')) + ")" : "") + (exportObj.isReleased(data.pilot) ? "" : " (" + (exportObj.translate(this.language, 'ui', 'unreleased')) + ")"));
          this.info_container.find('p.info-text').html((_ref7 = data.pilot.text) != null ? _ref7 : '');
          this.info_container.find('tr.info-ship td.info-data').text(data.pilot.ship);
          this.info_container.find('tr.info-ship').show();
          this.info_container.find('tr.info-skill td.info-data').text(statAndEffectiveStat(data.pilot.skill, effective_stats, 'skill'));
          this.info_container.find('tr.info-skill').show();
          _ref8 = this.info_container.find('tr.info-attack td.info-header i.xwing-miniatures-font')[0].classList;
          for (_i = 0, _len = _ref8.length; _i < _len; _i++) {
            cls = _ref8[_i];
            if (cls.startsWith('xwing-miniatures-font-attack')) {
              this.info_container.find('tr.info-attack td.info-header i.xwing-miniatures-font').removeClass(cls);
            }
          }
          this.info_container.find('tr.info-attack td.info-header i.xwing-miniatures-font').addClass((_ref9 = data.data.attack_icon) != null ? _ref9 : 'xwing-miniatures-font-attack');
          this.info_container.find('tr.info-attack td.info-data').text(statAndEffectiveStat((_ref10 = (_ref11 = data.pilot.ship_override) != null ? _ref11.attack : void 0) != null ? _ref10 : data.data.attack, effective_stats, 'attack'));
          this.info_container.find('tr.info-attack').toggle((((_ref12 = data.pilot.ship_override) != null ? _ref12.attack : void 0) != null) || (data.data.attack != null));
          this.info_container.find('tr.info-energy td.info-data').text(statAndEffectiveStat((_ref13 = (_ref14 = data.pilot.ship_override) != null ? _ref14.energy : void 0) != null ? _ref13 : data.data.energy, effective_stats, 'energy'));
          this.info_container.find('tr.info-energy').toggle((((_ref15 = data.pilot.ship_override) != null ? _ref15.energy : void 0) != null) || (data.data.energy != null));
          this.info_container.find('tr.info-range').hide();
          this.info_container.find('tr.info-agility td.info-data').text(statAndEffectiveStat((_ref16 = (_ref17 = data.pilot.ship_override) != null ? _ref17.agility : void 0) != null ? _ref16 : data.data.agility, effective_stats, 'agility'));
          this.info_container.find('tr.info-agility').show();
          this.info_container.find('tr.info-hull td.info-data').text(statAndEffectiveStat((_ref18 = (_ref19 = data.pilot.ship_override) != null ? _ref19.hull : void 0) != null ? _ref18 : data.data.hull, effective_stats, 'hull'));
          this.info_container.find('tr.info-hull').show();
          this.info_container.find('tr.info-shields td.info-data').text(statAndEffectiveStat((_ref20 = (_ref21 = data.pilot.ship_override) != null ? _ref21.shields : void 0) != null ? _ref20 : data.data.shields, effective_stats, 'shields'));
          this.info_container.find('tr.info-shields').show();
          this.info_container.find('tr.info-actions td.info-data').html(((function() {
            var _j, _len1, _ref22, _results;
            _ref22 = data.data.actions.concat((function() {
              var _k, _len1, _results1;
              _results1 = [];
              for (_k = 0, _len1 = extra_actions.length; _k < _len1; _k++) {
                action = extra_actions[_k];
                _results1.push("<strong>" + (exportObj.translate(this.language, 'action', action)) + "</strong>");
              }
              return _results1;
            }).call(this));
            _results = [];
            for (_j = 0, _len1 = _ref22.length; _j < _len1; _j++) {
              a = _ref22[_j];
              _results.push(exportObj.translate(this.language, 'action', a));
            }
            return _results;
          }).call(this)).join(', '));
          this.info_container.find('tr.info-actions').show();
          this.info_container.find('tr.info-upgrades').show();
          this.info_container.find('tr.info-upgrades td.info-data').text(((function() {
            var _j, _len1, _ref22, _results;
            _ref22 = data.pilot.slots;
            _results = [];
            for (_j = 0, _len1 = _ref22.length; _j < _len1; _j++) {
              slot = _ref22[_j];
              _results.push(exportObj.translate(this.language, 'slot', slot));
            }
            return _results;
          }).call(this)).join(', ') || 'None');
          this.info_container.find('p.info-maneuvers').show();
          this.info_container.find('p.info-maneuvers').html(this.getManeuverTableHTML(effective_stats.maneuvers, data.data.maneuvers));
          break;
        case 'Pilot':
          this.info_container.find('.info-sources').text(((function() {
            var _j, _len1, _ref22, _results;
            _ref22 = data.sources;
            _results = [];
            for (_j = 0, _len1 = _ref22.length; _j < _len1; _j++) {
              source = _ref22[_j];
              _results.push(exportObj.translate(this.language, 'sources', source));
            }
            return _results;
          }).call(this)).sort().join(', '));
          if (((_ref22 = this.collection) != null ? _ref22.counts : void 0) != null) {
            pilot_count = (_ref23 = (_ref24 = this.collection.counts) != null ? (_ref25 = _ref24.pilot) != null ? _ref25[data.english_name] : void 0 : void 0) != null ? _ref23 : 0;
            ship_count = (_ref26 = (_ref27 = this.collection.counts.ship) != null ? _ref27[additional_opts.ship] : void 0) != null ? _ref26 : 0;
            this.info_container.find('.info-collection').text("You have " + ship_count + " ship model" + (ship_count > 1 ? 's' : '') + " and " + pilot_count + " pilot card" + (pilot_count > 1 ? 's' : '') + " in your collection.");
          } else {
            this.info_container.find('.info-collection').text('');
          }
          this.info_container.find('.info-name').html("" + (data.unique ? "&middot;&nbsp;" : "") + data.name + (data.epic != null ? " (" + (exportObj.translate(this.language, 'ui', 'epic')) + ")" : "") + (exportObj.isReleased(data) ? "" : " (" + (exportObj.translate(this.language, 'ui', 'unreleased')) + ")"));
          this.info_container.find('p.info-text').html((_ref28 = data.text) != null ? _ref28 : '');
          ship = exportObj.ships[data.ship];
          this.info_container.find('tr.info-ship td.info-data').text(data.ship);
          this.info_container.find('tr.info-ship').show();
          this.info_container.find('tr.info-skill td.info-data').text(data.skill);
          this.info_container.find('tr.info-skill').show();
          this.info_container.find('tr.info-attack td.info-data').text((_ref29 = (_ref30 = data.ship_override) != null ? _ref30.attack : void 0) != null ? _ref29 : ship.attack);
          this.info_container.find('tr.info-attack').toggle((((_ref31 = data.ship_override) != null ? _ref31.attack : void 0) != null) || (ship.attack != null));
          _ref32 = this.info_container.find('tr.info-attack td.info-header i.xwing-miniatures-font')[0].classList;
          for (_j = 0, _len1 = _ref32.length; _j < _len1; _j++) {
            cls = _ref32[_j];
            if (cls.startsWith('xwing-miniatures-font-attack')) {
              this.info_container.find('tr.info-attack td.info-header i.xwing-miniatures-font').removeClass(cls);
            }
          }
          this.info_container.find('tr.info-attack td.info-header i.xwing-miniatures-font').addClass((_ref33 = ship.attack_icon) != null ? _ref33 : 'xwing-miniatures-font-attack');
          this.info_container.find('tr.info-energy td.info-data').text((_ref34 = (_ref35 = data.ship_override) != null ? _ref35.energy : void 0) != null ? _ref34 : ship.energy);
          this.info_container.find('tr.info-energy').toggle((((_ref36 = data.ship_override) != null ? _ref36.energy : void 0) != null) || (ship.energy != null));
          this.info_container.find('tr.info-range').hide();
          this.info_container.find('tr.info-agility td.info-data').text((_ref37 = (_ref38 = data.ship_override) != null ? _ref38.agility : void 0) != null ? _ref37 : ship.agility);
          this.info_container.find('tr.info-agility').show();
          this.info_container.find('tr.info-hull td.info-data').text((_ref39 = (_ref40 = data.ship_override) != null ? _ref40.hull : void 0) != null ? _ref39 : ship.hull);
          this.info_container.find('tr.info-hull').show();
          this.info_container.find('tr.info-shields td.info-data').text((_ref41 = (_ref42 = data.ship_override) != null ? _ref42.shields : void 0) != null ? _ref41 : ship.shields);
          this.info_container.find('tr.info-shields').show();
          this.info_container.find('tr.info-actions td.info-data').text(((function() {
            var _k, _len2, _ref43, _ref44, _ref45, _results;
            _ref45 = (_ref43 = (_ref44 = data.ship_override) != null ? _ref44.actions : void 0) != null ? _ref43 : exportObj.ships[data.ship].actions;
            _results = [];
            for (_k = 0, _len2 = _ref45.length; _k < _len2; _k++) {
              action = _ref45[_k];
              _results.push(exportObj.translate(this.language, 'action', action));
            }
            return _results;
          }).call(this)).join(', '));
          this.info_container.find('tr.info-actions').show();
          this.info_container.find('tr.info-upgrades').show();
          this.info_container.find('tr.info-upgrades td.info-data').text(((function() {
            var _k, _len2, _ref43, _results;
            _ref43 = data.slots;
            _results = [];
            for (_k = 0, _len2 = _ref43.length; _k < _len2; _k++) {
              slot = _ref43[_k];
              _results.push(exportObj.translate(this.language, 'slot', slot));
            }
            return _results;
          }).call(this)).join(', ') || 'None');
          this.info_container.find('p.info-maneuvers').show();
          this.info_container.find('p.info-maneuvers').html(this.getManeuverTableHTML(ship.maneuvers, ship.maneuvers));
          break;
        case 'Addon':
          this.info_container.find('.info-sources').text(((function() {
            var _k, _len2, _ref43, _results;
            _ref43 = data.sources;
            _results = [];
            for (_k = 0, _len2 = _ref43.length; _k < _len2; _k++) {
              source = _ref43[_k];
              _results.push(exportObj.translate(this.language, 'sources', source));
            }
            return _results;
          }).call(this)).sort().join(', '));
          if (((_ref43 = this.collection) != null ? _ref43.counts : void 0) != null) {
            addon_count = (_ref44 = (_ref45 = this.collection.counts) != null ? (_ref46 = _ref45[additional_opts.addon_type.toLowerCase()]) != null ? _ref46[data.english_name] : void 0 : void 0) != null ? _ref44 : 0;
            this.info_container.find('.info-collection').text("You have " + addon_count + " in your collection.");
          } else {
            this.info_container.find('.info-collection').text('');
          }
          this.info_container.find('.info-name').html("" + (data.unique ? "&middot;&nbsp;" : "") + data.name + (data.limited != null ? " (" + (exportObj.translate(this.language, 'ui', 'limited')) + ")" : "") + (data.epic != null ? " (" + (exportObj.translate(this.language, 'ui', 'epic')) + ")" : "") + (exportObj.isReleased(data) ? "" : " (" + (exportObj.translate(this.language, 'ui', 'unreleased')) + ")"));
          this.info_container.find('p.info-text').html((_ref47 = data.text) != null ? _ref47 : '');
          this.info_container.find('tr.info-ship').hide();
          this.info_container.find('tr.info-skill').hide();
          if (data.energy != null) {
            this.info_container.find('tr.info-energy td.info-data').text(data.energy);
            this.info_container.find('tr.info-energy').show();
          } else {
            this.info_container.find('tr.info-energy').hide();
          }
          if (data.attack != null) {
            _ref48 = this.info_container.find('tr.info-attack td.info-header i.xwing-miniatures-font')[0].classList;
            for (_k = 0, _len2 = _ref48.length; _k < _len2; _k++) {
              cls = _ref48[_k];
              if (cls.startsWith('xwing-miniatures-font-attack')) {
                this.info_container.find('tr.info-attack td.info-header i.xwing-miniatures-font').removeClass(cls);
              }
            }
            this.info_container.find('tr.info-attack td.info-header i.xwing-miniatures-font').addClass('xwing-miniatures-font-attack');
            this.info_container.find('tr.info-attack td.info-data').text(data.attack);
            this.info_container.find('tr.info-attack').show();
          } else {
            this.info_container.find('tr.info-attack').hide();
          }
          if (data.range != null) {
            this.info_container.find('tr.info-range td.info-data').text(data.range);
            this.info_container.find('tr.info-range').show();
          } else {
            this.info_container.find('tr.info-range').hide();
          }
          this.info_container.find('tr.info-agility').hide();
          this.info_container.find('tr.info-hull').hide();
          this.info_container.find('tr.info-shields').hide();
          this.info_container.find('tr.info-actions').hide();
          this.info_container.find('tr.info-upgrades').hide();
          this.info_container.find('p.info-maneuvers').hide();
      }
      this.info_container.show();
      return this.tooltip_currently_displaying = data;
    }
  };

  SquadBuilder.prototype._randomizerLoopBody = function(data) {
    var addon, available_modifications, available_pilots, available_ships, available_titles, available_upgrades, idx, modification, new_ship, pilot, removable_things, ship, ship_type, thing_to_remove, title, unused_addons, upgrade, _i, _j, _k, _l, _len, _len1, _len2, _len3, _len4, _len5, _m, _n, _ref, _ref1, _ref2, _ref3, _ref4, _ref5, _ref6, _ref7;
    if (data.keep_running && data.iterations < data.max_iterations) {
      data.iterations++;
      if (this.total_points === data.max_points) {
        data.keep_running = false;
      } else if (this.total_points < data.max_points) {
        unused_addons = [];
        _ref = this.ships;
        for (_i = 0, _len = _ref.length; _i < _len; _i++) {
          ship = _ref[_i];
          _ref1 = ship.upgrades;
          for (_j = 0, _len1 = _ref1.length; _j < _len1; _j++) {
            upgrade = _ref1[_j];
            if (upgrade.data == null) {
              unused_addons.push(upgrade);
            }
          }
          if ((ship.title != null) && (ship.title.data == null)) {
            unused_addons.push(ship.title);
          }
          _ref2 = ship.modifications;
          for (_k = 0, _len2 = _ref2.length; _k < _len2; _k++) {
            modification = _ref2[_k];
            if (modification.data == null) {
              unused_addons.push(modification);
            }
          }
        }
        idx = $.randomInt(1 + unused_addons.length);
        if (idx === 0) {
          available_ships = this.getAvailableShipsMatching();
          ship_type = available_ships[$.randomInt(available_ships.length)].text;
          available_pilots = this.getAvailablePilotsForShipIncluding(ship_type);
          pilot = available_pilots[$.randomInt(available_pilots.length)];
          if (exportObj.pilotsById[pilot.id].sources.intersects(data.allowed_sources)) {
            new_ship = this.addShip();
            new_ship.setPilotById(pilot.id);
          }
        } else {
          addon = unused_addons[idx - 1];
          switch (addon.type) {
            case 'Upgrade':
              available_upgrades = (function() {
                var _l, _len3, _ref3, _results;
                _ref3 = this.getAvailableUpgradesIncluding(addon.slot, null, addon.ship);
                _results = [];
                for (_l = 0, _len3 = _ref3.length; _l < _len3; _l++) {
                  upgrade = _ref3[_l];
                  if (exportObj.upgradesById[upgrade.id].sources.intersects(data.allowed_sources)) {
                    _results.push(upgrade);
                  }
                }
                return _results;
              }).call(this);
              if (available_upgrades.length > 0) {
                addon.setById(available_upgrades[$.randomInt(available_upgrades.length)].id);
              }
              break;
            case 'Title':
              available_titles = (function() {
                var _l, _len3, _ref3, _results;
                _ref3 = this.getAvailableTitlesIncluding(addon.ship);
                _results = [];
                for (_l = 0, _len3 = _ref3.length; _l < _len3; _l++) {
                  title = _ref3[_l];
                  if (exportObj.titlesById[title.id].sources.intersects(data.allowed_sources)) {
                    _results.push(title);
                  }
                }
                return _results;
              }).call(this);
              if (available_titles.length > 0) {
                addon.setById(available_titles[$.randomInt(available_titles.length)].id);
              }
              break;
            case 'Modification':
              available_modifications = (function() {
                var _l, _len3, _ref3, _results;
                _ref3 = this.getAvailableModificationsIncluding(null, addon.ship);
                _results = [];
                for (_l = 0, _len3 = _ref3.length; _l < _len3; _l++) {
                  modification = _ref3[_l];
                  if (exportObj.modificationsById[modification.id].sources.intersects(data.allowed_sources)) {
                    _results.push(modification);
                  }
                }
                return _results;
              }).call(this);
              if (available_modifications.length > 0) {
                addon.setById(available_modifications[$.randomInt(available_modifications.length)].id);
              }
              break;
            default:
              throw new Error("Invalid addon type " + addon.type);
          }
        }
      } else {
        removable_things = [];
        _ref3 = this.ships;
        for (_l = 0, _len3 = _ref3.length; _l < _len3; _l++) {
          ship = _ref3[_l];
          removable_things.push(ship);
          _ref4 = ship.upgrades;
          for (_m = 0, _len4 = _ref4.length; _m < _len4; _m++) {
            upgrade = _ref4[_m];
            if (upgrade.data != null) {
              removable_things.push(upgrade);
            }
          }
          if (((_ref5 = ship.title) != null ? _ref5.data : void 0) != null) {
            removable_things.push(ship.title);
          }
          if (((_ref6 = ship.modification) != null ? _ref6.data : void 0) != null) {
            removable_things.push(ship.modification);
          }
        }
        if (removable_things.length > 0) {
          thing_to_remove = removable_things[$.randomInt(removable_things.length)];
          if (thing_to_remove instanceof Ship) {
            this.removeShip(thing_to_remove);
          } else if (thing_to_remove instanceof GenericAddon) {
            thing_to_remove.setData(null);
          } else {
            throw new Error("Unknown thing to remove " + thing_to_remove);
          }
        }
      }
      return window.setTimeout(this._makeRandomizerLoopFunc(data), 0);
    } else {
      window.clearTimeout(data.timer);
      _ref7 = this.ships;
      for (_n = 0, _len5 = _ref7.length; _n < _len5; _n++) {
        ship = _ref7[_n];
        ship.updateSelections();
      }
      this.suppress_automatic_new_ship = false;
      return this.addShip();
    }
  };

  SquadBuilder.prototype._makeRandomizerLoopFunc = function(data) {
    return (function(_this) {
      return function() {
        return _this._randomizerLoopBody(data);
      };
    })(this);
  };

  SquadBuilder.prototype.randomSquad = function(max_points, allowed_sources, timeout_ms, max_iterations) {
    var data, stopHandler;
    if (max_points == null) {
      max_points = 100;
    }
    if (allowed_sources == null) {
      allowed_sources = null;
    }
    if (timeout_ms == null) {
      timeout_ms = 1000;
    }
    if (max_iterations == null) {
      max_iterations = 1000;
    }
    this.backend_status.fadeOut('slow');
    this.suppress_automatic_new_ship = true;
    while (this.ships.length > 0) {
      this.removeShip(this.ships[0]);
    }
    if (this.ships.length > 0) {
      throw new Error("Ships not emptied");
    }
    data = {
      iterations: 0,
      max_points: max_points,
      max_iterations: max_iterations,
      keep_running: true,
      allowed_sources: allowed_sources != null ? allowed_sources : exportObj.expansions
    };
    stopHandler = (function(_this) {
      return function() {
        return data.keep_running = false;
      };
    })(this);
    data.timer = window.setTimeout(stopHandler, timeout_ms);
    window.setTimeout(this._makeRandomizerLoopFunc(data), 0);
    this.resetCurrentSquad();
    this.current_squad.name = 'Random Squad';
    return this.container.trigger('xwing-backend:squadNameChanged');
  };

  SquadBuilder.prototype.setBackend = function(backend) {
    return this.backend = backend;
  };

  SquadBuilder.prototype.describeSquad = function() {
    var ship;
    return ((function() {
      var _i, _len, _ref, _results;
      _ref = this.ships;
      _results = [];
      for (_i = 0, _len = _ref.length; _i < _len; _i++) {
        ship = _ref[_i];
        if (ship.pilot != null) {
          _results.push(ship.pilot.name);
        }
      }
      return _results;
    }).call(this)).join(', ');
  };

  SquadBuilder.prototype.listCards = function() {
    var card_obj, ship, upgrade, _i, _j, _len, _len1, _ref, _ref1, _ref2, _ref3;
    card_obj = {};
    _ref = this.ships;
    for (_i = 0, _len = _ref.length; _i < _len; _i++) {
      ship = _ref[_i];
      if (ship.pilot != null) {
        card_obj[ship.pilot.name] = null;
        _ref1 = ship.upgrades;
        for (_j = 0, _len1 = _ref1.length; _j < _len1; _j++) {
          upgrade = _ref1[_j];
          if (upgrade.data != null) {
            card_obj[upgrade.data.name] = null;
          }
        }
        if (((_ref2 = ship.title) != null ? _ref2.data : void 0) != null) {
          card_obj[ship.title.data.name] = null;
        }
        if (((_ref3 = ship.modification) != null ? _ref3.data : void 0) != null) {
          card_obj[ship.modification.data.name] = null;
        }
      }
    }
    return Object.keys(card_obj).sort();
  };

  SquadBuilder.prototype.getNotes = function() {
    return this.notes.val();
  };

  SquadBuilder.prototype.getObstacles = function() {
    return this.current_obstacles;
  };

  SquadBuilder.prototype.isSquadPossibleWithCollection = function() {
    var modification, modification_is_available, pilot_is_available, ship, ship_is_available, title, title_is_available, upgrade, upgrade_is_available, validity, _i, _j, _k, _l, _len, _len1, _len2, _len3, _ref, _ref1, _ref2, _ref3, _ref4, _ref5;
    if (Object.keys((_ref = (_ref1 = this.collection) != null ? _ref1.expansions : void 0) != null ? _ref : {}).length === 0) {
      return true;
    }
    this.collection.reset();
    validity = true;
    _ref2 = this.ships;
    for (_i = 0, _len = _ref2.length; _i < _len; _i++) {
      ship = _ref2[_i];
      if (ship.pilot != null) {
        ship_is_available = this.collection.use('ship', ship.pilot.english_ship);
        pilot_is_available = this.collection.use('pilot', ship.pilot.english_name);
        if (!(ship_is_available && pilot_is_available)) {
          validity = false;
        }
        _ref3 = ship.upgrades;
        for (_j = 0, _len1 = _ref3.length; _j < _len1; _j++) {
          upgrade = _ref3[_j];
          if (upgrade.data != null) {
            upgrade_is_available = this.collection.use('upgrade', upgrade.data.english_name);
            if (!upgrade_is_available) {
              validity = false;
            }
          }
        }
        _ref4 = ship.modifications;
        for (_k = 0, _len2 = _ref4.length; _k < _len2; _k++) {
          modification = _ref4[_k];
          if (modification.data != null) {
            modification_is_available = this.collection.use('modification', modification.data.english_name);
            if (!modification_is_available) {
              validity = false;
            }
          }
        }
        _ref5 = ship.titles;
        for (_l = 0, _len3 = _ref5.length; _l < _len3; _l++) {
          title = _ref5[_l];
          if ((title != null ? title.data : void 0) != null) {
            title_is_available = this.collection.use('title', title.data.english_name);
            if (!title_is_available) {
              validity = false;
            }
          }
        }
      }
    }
    return validity;
  };

  SquadBuilder.prototype.checkCollection = function() {
    if (this.collection != null) {
      return this.collection_invalid_container.toggleClass('hidden', this.isSquadPossibleWithCollection());
    }
  };

  SquadBuilder.prototype.toXWS = function() {
    var candidate, last_id, match, matches, multisection_id_to_pilots, obstacles, pilot, ship, unmatched, unmatched_pilot, xws, _, _i, _j, _k, _l, _len, _len1, _len2, _len3, _m, _name, _ref, _ref1, _ref2, _ref3;
    xws = {
      description: this.getNotes(),
      faction: exportObj.toXWSFaction[this.faction],
      name: this.current_squad.name,
      pilots: [],
      points: this.total_points,
      vendor: {
        yasb: {
          builder: '(Yet Another) X-Wing Miniatures Squad Builder',
          builder_url: window.location.href.split('?')[0],
          link: this.getPermaLink()
        }
      },
      version: '0.3.0'
    };
    _ref = this.ships;
    for (_i = 0, _len = _ref.length; _i < _len; _i++) {
      ship = _ref[_i];
      if (ship.pilot != null) {
        xws.pilots.push(ship.toXWS());
      }
    }
    multisection_id_to_pilots = {};
    last_id = 0;
    unmatched = (function() {
      var _j, _len1, _ref1, _results;
      _ref1 = xws.pilots;
      _results = [];
      for (_j = 0, _len1 = _ref1.length; _j < _len1; _j++) {
        pilot = _ref1[_j];
        if (pilot.multisection != null) {
          _results.push(pilot);
        }
      }
      return _results;
    })();
    for (_ = _j = 0, _ref1 = Math.pow(unmatched.length, 2); 0 <= _ref1 ? _j < _ref1 : _j > _ref1; _ = 0 <= _ref1 ? ++_j : --_j) {
      if (unmatched.length === 0) {
        break;
      }
      unmatched_pilot = unmatched.shift();
      if (unmatched_pilot.multisection_id == null) {
        unmatched_pilot.multisection_id = last_id++;
      }
      if (multisection_id_to_pilots[_name = unmatched_pilot.multisection_id] == null) {
        multisection_id_to_pilots[_name] = [unmatched_pilot];
      }
      if (unmatched.length === 0) {
        break;
      }
      matches = [];
      for (_k = 0, _len1 = unmatched.length; _k < _len1; _k++) {
        candidate = unmatched[_k];
        if (_ref2 = unmatched_pilot.name, __indexOf.call(candidate.multisection, _ref2) >= 0) {
          matches.push(candidate);
          unmatched_pilot.multisection.removeItem(candidate.name);
          candidate.multisection.removeItem(unmatched_pilot.name);
          candidate.multisection_id = unmatched_pilot.multisection_id;
          multisection_id_to_pilots[candidate.multisection_id].push(candidate);
          if (unmatched_pilot.multisection.length === 0) {
            break;
          }
        }
      }
      for (_l = 0, _len2 = matches.length; _l < _len2; _l++) {
        match = matches[_l];
        if (match.multisection.length === 0) {
          unmatched.removeItem(match);
        }
      }
    }
    _ref3 = xws.pilots;
    for (_m = 0, _len3 = _ref3.length; _m < _len3; _m++) {
      pilot = _ref3[_m];
      if (pilot.multisection != null) {
        delete pilot.multisection;
      }
    }
    obstacles = this.getObstacles();
    if ((obstacles != null) && obstacles.length > 0) {
      xws.obstacles = obstacles;
    }
    return xws;
  };

  SquadBuilder.prototype.toMinimalXWS = function() {
    var k, v, xws, _ref;
    xws = this.toXWS();
    for (k in xws) {
      if (!__hasProp.call(xws, k)) continue;
      v = xws[k];
      if (k !== 'faction' && k !== 'pilots' && k !== 'version') {
        delete xws[k];
      }
    }
    _ref = xws.pilots;
    for (k in _ref) {
      if (!__hasProp.call(_ref, k)) continue;
      v = _ref[k];
      if (k !== 'name' && k !== 'ship' && k !== 'upgrades' && k !== 'multisection_id') {
        delete xws[k];
      }
    }
    return xws;
  };

  SquadBuilder.prototype.loadFromXWS = function(xws, cb) {
    var a, addon, addon_added, addons, err, error, i, modification, new_ship, p, pilot, slot, slot_guesses, success, title, upgrade, upgrade_canonical, upgrade_canonicals, upgrade_type, version_list, x, xws_faction, yasb_upgrade_type, _, _i, _j, _k, _l, _len, _len1, _len2, _len3, _len4, _m, _n, _ref, _ref1, _ref2, _ref3, _ref4, _ref5, _ref6;
    success = null;
    error = null;
    version_list = (function() {
      var _i, _len, _ref, _results;
      _ref = xws.version.split('.');
      _results = [];
      for (_i = 0, _len = _ref.length; _i < _len; _i++) {
        x = _ref[_i];
        _results.push(parseInt(x));
      }
      return _results;
    })();
    switch (false) {
      case !(version_list > [0, 1]):
        xws_faction = exportObj.fromXWSFaction[xws.faction];
        if (this.faction !== xws_faction) {
          throw new Error("Attempted to load XWS for " + xws.faction + " but builder is " + this.faction);
        }
        if (xws.name != null) {
          this.current_squad.name = xws.name;
        }
        if (xws.description != null) {
          this.notes.val(xws.description);
        }
        if (xws.obstacles != null) {
          this.current_squad.additional_data.obstacles = xws.obstacles;
        }
        this.suppress_automatic_new_ship = true;
        this.removeAllShips();
        _ref = xws.pilots;
        for (_i = 0, _len = _ref.length; _i < _len; _i++) {
          pilot = _ref[_i];
          new_ship = this.addShip();
          try {
            new_ship.setPilot(((function() {
              var _j, _len1, _ref1, _results;
              _ref1 = exportObj.pilotsByFactionCanonicalName[this.faction][pilot.name];
              _results = [];
              for (_j = 0, _len1 = _ref1.length; _j < _len1; _j++) {
                p = _ref1[_j];
                if (p.ship.canonicalize() === pilot.ship) {
                  _results.push(p);
                }
              }
              return _results;
            }).call(this))[0]);
          } catch (_error) {
            err = _error;
            continue;
          }
          addons = [];
          _ref2 = (_ref1 = pilot.upgrades) != null ? _ref1 : {};
          for (upgrade_type in _ref2) {
            upgrade_canonicals = _ref2[upgrade_type];
            for (_j = 0, _len1 = upgrade_canonicals.length; _j < _len1; _j++) {
              upgrade_canonical = upgrade_canonicals[_j];
              slot = null;
              yasb_upgrade_type = (_ref3 = exportObj.fromXWSUpgrade[upgrade_type]) != null ? _ref3 : upgrade_type.capitalize();
              addon = (function() {
                switch (yasb_upgrade_type) {
                  case 'Modification':
                    return exportObj.modificationsByCanonicalName[upgrade_canonical];
                  case 'Title':
                    return exportObj.titlesByCanonicalName[upgrade_canonical];
                  default:
                    slot = yasb_upgrade_type;
                    return exportObj.upgradesBySlotCanonicalName[slot][upgrade_canonical];
                }
              })();
              if (addon != null) {
                addons.push({
                  type: yasb_upgrade_type,
                  data: addon,
                  slot: slot
                });
              }
            }
          }
          if (addons.length > 0) {
            for (_ = _k = 0; _k < 1000; _ = ++_k) {
              addon = addons.shift();
              addon_added = false;
              switch (addon.type) {
                case 'Modification':
                  _ref4 = new_ship.modifications;
                  for (_l = 0, _len2 = _ref4.length; _l < _len2; _l++) {
                    modification = _ref4[_l];
                    if (modification.data != null) {
                      continue;
                    }
                    modification.setData(addon.data);
                    addon_added = true;
                    break;
                  }
                  break;
                case 'Title':
                  _ref5 = new_ship.titles;
                  for (_m = 0, _len3 = _ref5.length; _m < _len3; _m++) {
                    title = _ref5[_m];
                    if (title.data != null) {
                      continue;
                    }
                    if (addon.data instanceof Array) {
                      slot_guesses = (function() {
                        var _len4, _n, _ref6, _results;
                        _results = [];
                        for (_n = 0, _len4 = addons.length; _n < _len4; _n++) {
                          a = addons[_n];
                          if ((_ref6 = a.data.slot) === 'Cannon' || _ref6 === 'Missile' || _ref6 === 'Torpedo') {
                            _results.push(a.data.slot);
                          }
                        }
                        return _results;
                      })();
                      if (slot_guesses.length > 0) {
                        title.setData(exportObj.titlesByLocalizedName["\"Heavy Scyk\" Interceptor (" + slot_guesses[0] + ")"]);
                      } else {
                        title.setData(addon.data[0]);
                      }
                    } else {
                      title.setData(addon.data);
                    }
                    addon_added = true;
                  }
                  break;
                default:
                  _ref6 = new_ship.upgrades;
                  for (i = _n = 0, _len4 = _ref6.length; _n < _len4; i = ++_n) {
                    upgrade = _ref6[i];
                    if (upgrade.slot !== addon.slot || (upgrade.data != null)) {
                      continue;
                    }
                    upgrade.setData(addon.data);
                    addon_added = true;
                    break;
                  }
              }
              if (addon_added) {
                if (addons.length === 0) {
                  break;
                }
              } else {
                if (addons.length === 0) {
                  success = false;
                  error = "Could not add " + addon.data.name + " to " + new_ship;
                  break;
                } else {
                  addons.push(addon);
                }
              }
            }
            if (addons.length > 0) {
              success = false;
              error = "Could not add all upgrades";
              break;
            }
          }
        }
        this.suppress_automatic_new_ship = false;
        this.addShip();
        success = true;
        break;
      default:
        success = false;
        error = "Invalid or unsupported XWS version";
    }
    if (success) {
      this.current_squad.dirty = true;
      this.container.trigger('xwing-backend:squadNameChanged');
      this.container.trigger('xwing-backend:squadDirtinessChanged');
    }
    return cb({
      success: success,
      error: error
    });
  };

  return SquadBuilder;

})();

Ship = (function() {
  function Ship(args) {
    this.builder = args.builder;
    this.container = args.container;
    this.pilot = null;
    this.data = null;
    this.upgrades = [];
    this.modifications = [];
    this.titles = [];
    this.setupUI();
  }

  Ship.prototype.destroy = function(cb) {
    var idx;
    this.resetPilot();
    this.resetAddons();
    this.teardownUI();
    idx = this.builder.ships.indexOf(this);
    if (idx < 0) {
      throw new Error("Ship not registered with builder");
    }
    this.builder.ships.splice(idx, 1);
    return cb();
  };

  Ship.prototype.copyFrom = function(other) {
    var available_pilots, i, modification, other_conferred_addon, other_conferred_addons, other_modification, other_modifications, other_title, other_titles, other_upgrade, other_upgrades, pilot_data, title, upgrade, _i, _j, _k, _l, _len, _len1, _len2, _len3, _len4, _len5, _len6, _len7, _len8, _m, _n, _name, _o, _p, _q, _ref, _ref1, _ref10, _ref11, _ref12, _ref13, _ref14, _ref15, _ref2, _ref3, _ref4, _ref5, _ref6, _ref7, _ref8, _ref9;
    if (other === this) {
      throw new Error("Cannot copy from self");
    }
    if (!((other.pilot != null) && (other.data != null))) {
      return;
    }
    if (other.pilot.unique) {
      available_pilots = (function() {
        var _i, _len, _ref, _results;
        _ref = this.builder.getAvailablePilotsForShipIncluding(other.data.name);
        _results = [];
        for (_i = 0, _len = _ref.length; _i < _len; _i++) {
          pilot_data = _ref[_i];
          if (!pilot_data.disabled) {
            _results.push(pilot_data);
          }
        }
        return _results;
      }).call(this);
      if (available_pilots.length > 0) {
        this.setPilotById(available_pilots[0].id);
        other_upgrades = {};
        _ref = other.upgrades;
        for (_i = 0, _len = _ref.length; _i < _len; _i++) {
          upgrade = _ref[_i];
          if (((upgrade != null ? upgrade.data : void 0) != null) && !upgrade.data.unique) {
            if (other_upgrades[_name = upgrade.slot] == null) {
              other_upgrades[_name] = [];
            }
            other_upgrades[upgrade.slot].push(upgrade);
          }
        }
        other_modifications = [];
        _ref1 = other.modifications;
        for (_j = 0, _len1 = _ref1.length; _j < _len1; _j++) {
          modification = _ref1[_j];
          if (((modification != null ? modification.data : void 0) != null) && !modification.data.unique) {
            other_modifications.push(modification);
          }
        }
        other_titles = [];
        _ref2 = other.titles;
        for (_k = 0, _len2 = _ref2.length; _k < _len2; _k++) {
          title = _ref2[_k];
          if (((title != null ? title.data : void 0) != null) && !title.data.unique) {
            other_titles.push(title);
          }
        }
        _ref3 = this.titles;
        for (_l = 0, _len3 = _ref3.length; _l < _len3; _l++) {
          title = _ref3[_l];
          other_title = other_titles.shift();
          if (other_title != null) {
            title.setById(other_title.data.id);
          }
        }
        _ref4 = this.modifications;
        for (_m = 0, _len4 = _ref4.length; _m < _len4; _m++) {
          modification = _ref4[_m];
          other_modification = other_modifications.shift();
          if (other_modification != null) {
            modification.setById(other_modification.data.id);
          }
        }
        _ref5 = this.upgrades;
        for (_n = 0, _len5 = _ref5.length; _n < _len5; _n++) {
          upgrade = _ref5[_n];
          other_upgrade = ((_ref6 = other_upgrades[upgrade.slot]) != null ? _ref6 : []).shift();
          if (other_upgrade != null) {
            upgrade.setById(other_upgrade.data.id);
          }
        }
      } else {
        return;
      }
    } else {
      this.setPilotById(other.pilot.id);
      other_conferred_addons = [];
      if (((_ref7 = other.titles[0]) != null ? _ref7.data : void 0) != null) {
        other_conferred_addons = other_conferred_addons.concat(other.titles[0].conferredAddons);
      }
      if (((_ref8 = other.modifications[0]) != null ? _ref8.data : void 0) != null) {
        other_conferred_addons = other_conferred_addons.concat(other.modifications[0].conferredAddons);
      }
      _ref9 = other.upgrades;
      for (i = _o = 0, _len6 = _ref9.length; _o < _len6; i = ++_o) {
        other_upgrade = _ref9[i];
        if ((other_upgrade.data != null) && __indexOf.call(other_conferred_addons, other_upgrade) < 0 && !other_upgrade.data.unique && i < this.upgrades.length) {
          this.upgrades[i].setById(other_upgrade.data.id);
        }
      }
      if ((((_ref10 = other.titles[0]) != null ? _ref10.data : void 0) != null) && !other.titles[0].data.unique) {
        this.titles[0].setById(other.titles[0].data.id);
      }
      if (((_ref11 = other.modifications[0]) != null ? _ref11.data : void 0) && !other.modifications[0].data.unique) {
        this.modifications[0].setById(other.modifications[0].data.id);
      }
      if ((other.titles[0] != null) && other.titles[0].conferredAddons.length > 0) {
        _ref12 = other.titles[0].conferredAddons;
        for (i = _p = 0, _len7 = _ref12.length; _p < _len7; i = ++_p) {
          other_conferred_addon = _ref12[i];
          if ((other_conferred_addon.data != null) && !((_ref13 = other_conferred_addon.data) != null ? _ref13.unique : void 0)) {
            this.titles[0].conferredAddons[i].setById(other_conferred_addon.data.id);
          }
        }
      }
      if ((other.modifications[0] != null) && other.modifications[0].conferredAddons.length > 0) {
        _ref14 = other.modifications[0].conferredAddons;
        for (i = _q = 0, _len8 = _ref14.length; _q < _len8; i = ++_q) {
          other_conferred_addon = _ref14[i];
          if ((other_conferred_addon.data != null) && !((_ref15 = other_conferred_addon.data) != null ? _ref15.unique : void 0)) {
            this.modifications[0].conferredAddons[i].setById(other_conferred_addon.data.id);
          }
        }
      }
    }
    this.updateSelections();
    this.builder.container.trigger('xwing:pointsUpdated');
    this.builder.current_squad.dirty = true;
    return this.builder.container.trigger('xwing-backend:squadDirtinessChanged');
  };

  Ship.prototype.setShipType = function(ship_type) {
    var cls, result, _i, _len, _ref, _ref1;
    this.pilot_selector.data('select2').container.show();
    if (ship_type !== ((_ref = this.pilot) != null ? _ref.ship : void 0)) {
      this.setPilot(((function() {
        var _i, _len, _ref1, _results;
        _ref1 = this.builder.getAvailablePilotsForShipIncluding(ship_type);
        _results = [];
        for (_i = 0, _len = _ref1.length; _i < _len; _i++) {
          result = _ref1[_i];
          if (!exportObj.pilotsById[result.id].unique) {
            _results.push(exportObj.pilotsById[result.id]);
          }
        }
        return _results;
      }).call(this))[0]);
    }
    _ref1 = this.row.attr('class').split(/\s+/);
    for (_i = 0, _len = _ref1.length; _i < _len; _i++) {
      cls = _ref1[_i];
      if (cls.indexOf('ship-') === 0) {
        this.row.removeClass(cls);
      }
    }
    this.remove_button.fadeIn('fast');
    this.row.addClass("ship-" + (ship_type.toLowerCase().replace(/[^a-z0-9]/gi, '')) + "0");
    return this.builder.container.trigger('xwing:shipUpdated');
  };

  Ship.prototype.setPilotById = function(id) {
    return this.setPilot(exportObj.pilotsById[parseInt(id)]);
  };

  Ship.prototype.setPilotByName = function(name) {
    return this.setPilot(exportObj.pilotsByLocalizedName[$.trim(name)]);
  };

  Ship.prototype.setPilot = function(new_pilot) {
    var modification, old_modification, old_modifications, old_title, old_titles, old_upgrade, old_upgrades, same_ship, title, upgrade, ___iced_passed_deferral, __iced_deferrals, __iced_k, _i, _j, _k, _len, _len1, _len2, _name, _ref, _ref1, _ref2;
    __iced_k = __iced_k_noop;
    ___iced_passed_deferral = iced.findDeferral(arguments);
    if (new_pilot !== this.pilot) {
      this.builder.current_squad.dirty = true;
      same_ship = (this.pilot != null) && (new_pilot != null ? new_pilot.ship : void 0) === this.pilot.ship;
      old_upgrades = {};
      old_titles = [];
      old_modifications = [];
      if (same_ship) {
        _ref = this.upgrades;
        for (_i = 0, _len = _ref.length; _i < _len; _i++) {
          upgrade = _ref[_i];
          if ((upgrade != null ? upgrade.data : void 0) != null) {
            if (old_upgrades[_name = upgrade.slot] == null) {
              old_upgrades[_name] = [];
            }
            old_upgrades[upgrade.slot].push(upgrade);
          }
        }
        _ref1 = this.titles;
        for (_j = 0, _len1 = _ref1.length; _j < _len1; _j++) {
          title = _ref1[_j];
          if ((title != null ? title.data : void 0) != null) {
            old_titles.push(title);
          }
        }
        _ref2 = this.modifications;
        for (_k = 0, _len2 = _ref2.length; _k < _len2; _k++) {
          modification = _ref2[_k];
          if ((modification != null ? modification.data : void 0) != null) {
            old_modifications.push(modification);
          }
        }
      }
      this.resetPilot();
      this.resetAddons();
      (function(_this) {
        return (function(__iced_k) {
          if (new_pilot != null) {
            _this.data = exportObj.ships[new_pilot != null ? new_pilot.ship : void 0];
            (function(__iced_k) {
              if ((new_pilot != null ? new_pilot.unique : void 0) != null) {
                (function(__iced_k) {
                  __iced_deferrals = new iced.Deferrals(__iced_k, {
                    parent: ___iced_passed_deferral,
                    funcname: "Ship.setPilot"
                  });
                  _this.builder.container.trigger('xwing:claimUnique', [
                    new_pilot, 'Pilot', __iced_deferrals.defer({
                      lineno: 19932
                    })
                  ]);
                  __iced_deferrals._fulfill();
                })(__iced_k);
              } else {
                return __iced_k();
              }
            })(function() {
              var _l, _len3, _len4, _len5, _m, _n, _ref3, _ref4, _ref5, _ref6;
              _this.pilot = new_pilot;
              if (_this.pilot != null) {
                _this.setupAddons();
              }
              _this.copy_button.show();
              _this.setShipType(_this.pilot.ship);
              if (same_ship) {
                _ref3 = _this.titles;
                for (_l = 0, _len3 = _ref3.length; _l < _len3; _l++) {
                  title = _ref3[_l];
                  old_title = old_titles.shift();
                  if (old_title != null) {
                    title.setById(old_title.data.id);
                  }
                }
                _ref4 = _this.modifications;
                for (_m = 0, _len4 = _ref4.length; _m < _len4; _m++) {
                  modification = _ref4[_m];
                  old_modification = old_modifications.shift();
                  if (old_modification != null) {
                    modification.setById(old_modification.data.id);
                  }
                }
                _ref5 = _this.upgrades;
                for (_n = 0, _len5 = _ref5.length; _n < _len5; _n++) {
                  upgrade = _ref5[_n];
                  old_upgrade = ((_ref6 = old_upgrades[upgrade.slot]) != null ? _ref6 : []).shift();
                  if (old_upgrade != null) {
                    upgrade.setById(old_upgrade.data.id);
                  }
                }
              }
              return __iced_k();
            });
          } else {
            return __iced_k(_this.copy_button.hide());
          }
        });
      })(this)((function(_this) {
        return function() {
          _this.builder.container.trigger('xwing:pointsUpdated');
          return __iced_k(_this.builder.container.trigger('xwing-backend:squadDirtinessChanged'));
        };
      })(this));
    } else {
      return __iced_k();
    }
  };

  Ship.prototype.resetPilot = function() {
    var ___iced_passed_deferral, __iced_deferrals, __iced_k;
    __iced_k = __iced_k_noop;
    ___iced_passed_deferral = iced.findDeferral(arguments);
    (function(_this) {
      return (function(__iced_k) {
        var _ref;
        if (((_ref = _this.pilot) != null ? _ref.unique : void 0) != null) {
          (function(__iced_k) {
            __iced_deferrals = new iced.Deferrals(__iced_k, {
              parent: ___iced_passed_deferral,
              funcname: "Ship.resetPilot"
            });
            _this.builder.container.trigger('xwing:releaseUnique', [
              _this.pilot, 'Pilot', __iced_deferrals.defer({
                lineno: 19958
              })
            ]);
            __iced_deferrals._fulfill();
          })(__iced_k);
        } else {
          return __iced_k();
        }
      });
    })(this)((function(_this) {
      return function() {
        return _this.pilot = null;
      };
    })(this));
  };

  Ship.prototype.setupAddons = function() {
    var slot, _i, _len, _ref, _ref1;
    _ref1 = (_ref = this.pilot.slots) != null ? _ref : [];
    for (_i = 0, _len = _ref1.length; _i < _len; _i++) {
      slot = _ref1[_i];
      this.upgrades.push(new exportObj.Upgrade({
        ship: this,
        container: this.addon_container,
        slot: slot
      }));
    }
    if (this.pilot.ship in exportObj.titlesByShip) {
      this.titles.push(new exportObj.Title({
        ship: this,
        container: this.addon_container
      }));
    }
    return this.modifications.push(new exportObj.Modification({
      ship: this,
      container: this.addon_container
    }));
  };

  Ship.prototype.resetAddons = function() {
    var modification, title, upgrade, ___iced_passed_deferral, __iced_deferrals, __iced_k;
    __iced_k = __iced_k_noop;
    ___iced_passed_deferral = iced.findDeferral(arguments);
    (function(_this) {
      return (function(__iced_k) {
        var _i, _j, _k, _len, _len1, _len2, _ref, _ref1, _ref2;
        __iced_deferrals = new iced.Deferrals(__iced_k, {
          parent: ___iced_passed_deferral,
          funcname: "Ship.resetAddons"
        });
        _ref = _this.titles;
        for (_i = 0, _len = _ref.length; _i < _len; _i++) {
          title = _ref[_i];
          if (title != null) {
            title.destroy(__iced_deferrals.defer({
              lineno: 19981
            }));
          }
        }
        _ref1 = _this.upgrades;
        for (_j = 0, _len1 = _ref1.length; _j < _len1; _j++) {
          upgrade = _ref1[_j];
          if (upgrade != null) {
            upgrade.destroy(__iced_deferrals.defer({
              lineno: 19983
            }));
          }
        }
        _ref2 = _this.modifications;
        for (_k = 0, _len2 = _ref2.length; _k < _len2; _k++) {
          modification = _ref2[_k];
          if (modification != null) {
            modification.destroy(__iced_deferrals.defer({
              lineno: 19985
            }));
          }
        }
        __iced_deferrals._fulfill();
      });
    })(this)((function(_this) {
      return function() {
        _this.upgrades = [];
        _this.modifications = [];
        return _this.titles = [];
      };
    })(this));
  };

  Ship.prototype.getPoints = function() {
    var modification, points, title, upgrade, _i, _j, _k, _len, _len1, _len2, _ref, _ref1, _ref2, _ref3, _ref4, _ref5, _ref6;
    points = (_ref = (_ref1 = this.pilot) != null ? _ref1.points : void 0) != null ? _ref : 0;
    _ref2 = this.titles;
    for (_i = 0, _len = _ref2.length; _i < _len; _i++) {
      title = _ref2[_i];
      points += (_ref3 = title != null ? title.getPoints() : void 0) != null ? _ref3 : 0;
    }
    _ref4 = this.upgrades;
    for (_j = 0, _len1 = _ref4.length; _j < _len1; _j++) {
      upgrade = _ref4[_j];
      points += upgrade.getPoints();
    }
    _ref5 = this.modifications;
    for (_k = 0, _len2 = _ref5.length; _k < _len2; _k++) {
      modification = _ref5[_k];
      points += (_ref6 = modification != null ? modification.getPoints() : void 0) != null ? _ref6 : 0;
    }
    this.points_container.find('span').text(points);
    if (points > 0) {
      this.points_container.fadeTo('fast', 1);
    } else {
      this.points_container.fadeTo(0, 0);
    }
    return points;
  };

  Ship.prototype.getEpicPoints = function() {
    var _ref, _ref1;
    return (_ref = (_ref1 = this.data) != null ? _ref1.epic_points : void 0) != null ? _ref : 0;
  };

  Ship.prototype.updateSelections = function() {
    var modification, title, upgrade, _i, _j, _k, _len, _len1, _len2, _ref, _ref1, _ref2, _results;
    if (this.pilot != null) {
      this.ship_selector.select2('data', {
        id: this.pilot.ship,
        text: this.pilot.ship,
        canonical_name: exportObj.ships[this.pilot.ship].canonical_name
      });
      this.pilot_selector.select2('data', {
        id: this.pilot.id,
        text: "" + this.pilot.name + " (" + this.pilot.points + ")"
      });
      this.pilot_selector.data('select2').container.show();
      _ref = this.upgrades;
      for (_i = 0, _len = _ref.length; _i < _len; _i++) {
        upgrade = _ref[_i];
        upgrade.updateSelection();
      }
      _ref1 = this.titles;
      for (_j = 0, _len1 = _ref1.length; _j < _len1; _j++) {
        title = _ref1[_j];
        if (title != null) {
          title.updateSelection();
        }
      }
      _ref2 = this.modifications;
      _results = [];
      for (_k = 0, _len2 = _ref2.length; _k < _len2; _k++) {
        modification = _ref2[_k];
        if (modification != null) {
          _results.push(modification.updateSelection());
        } else {
          _results.push(void 0);
        }
      }
      return _results;
    } else {
      this.pilot_selector.select2('data', null);
      return this.pilot_selector.data('select2').container.toggle(this.ship_selector.val() !== '');
    }
  };

  Ship.prototype.setupUI = function() {
    var shipResultFormatter;
    this.row = $(document.createElement('DIV'));
    this.row.addClass('row-fluid ship');
    this.row.insertBefore(this.builder.notes_container);
    this.row.append($.trim('<div class="span3">\n    <input class="ship-selector-container" type="hidden" />\n    <br />\n    <input type="hidden" class="pilot-selector-container" />\n</div>\n<div class="span1 points-display-container">\n    <span></span>\n</div>\n<div class="span6 addon-container" />\n<div class="span2 button-container">\n    <button class="btn btn-danger remove-pilot"><span class="visible-desktop visible-tablet hidden-phone" data-toggle="tooltip" title="Remove Pilot"><i class="fa fa-times"></i></span><span class="hidden-desktop hidden-tablet visible-phone">Remove Pilot</span></button>\n    <button class="btn copy-pilot"><span class="visible-desktop visible-tablet hidden-phone" data-toggle="tooltip" title="Clone Pilot"><i class="fa fa-files-o"></i></span><span class="hidden-desktop hidden-tablet visible-phone">Clone Pilot</span></button>\n</div>'));
    this.row.find('.button-container span').tooltip();
    this.ship_selector = $(this.row.find('input.ship-selector-container'));
    this.pilot_selector = $(this.row.find('input.pilot-selector-container'));
    shipResultFormatter = function(object, container, query) {
      $(container).append("<i class=\"xwing-miniatures-ship xwing-miniatures-ship-" + object.canonical_name + "\"></i> " + object.text);
      return void 0;
    };
    this.ship_selector.select2({
      width: '100%',
      placeholder: exportObj.translate(this.builder.language, 'ui', 'shipSelectorPlaceholder'),
      query: (function(_this) {
        return function(query) {
          _this.builder.checkCollection();
          return query.callback({
            more: false,
            results: _this.builder.getAvailableShipsMatching(query.term)
          });
        };
      })(this),
      minimumResultsForSearch: $.isMobile() ? -1 : 0,
      formatResultCssClass: (function(_this) {
        return function(obj) {
          var not_in_collection;
          if (_this.builder.collection != null) {
            not_in_collection = false;
            if ((_this.pilot != null) && obj.id === exportObj.ships[_this.pilot.ship].id) {
              if (!(_this.builder.collection.checkShelf('ship', obj.english_name) || _this.builder.collection.checkTable('pilot', obj.english_name))) {
                not_in_collection = true;
              }
            } else {
              not_in_collection = !_this.builder.collection.checkShelf('ship', obj.english_name);
            }
            if (not_in_collection) {
              return 'select2-result-not-in-collection';
            } else {
              return '';
            }
          } else {
            return '';
          }
        };
      })(this),
      formatResult: shipResultFormatter,
      formatSelection: shipResultFormatter
    });
    this.ship_selector.on('change', (function(_this) {
      return function(e) {
        return _this.setShipType(_this.ship_selector.val());
      };
    })(this));
    this.row.attr('id', "row-" + (this.ship_selector.data('select2').container.attr('id')));
    this.pilot_selector.select2({
      width: '100%',
      placeholder: exportObj.translate(this.builder.language, 'ui', 'pilotSelectorPlaceholder'),
      query: (function(_this) {
        return function(query) {
          _this.builder.checkCollection();
          return query.callback({
            more: false,
            results: _this.builder.getAvailablePilotsForShipIncluding(_this.ship_selector.val(), _this.pilot, query.term)
          });
        };
      })(this),
      minimumResultsForSearch: $.isMobile() ? -1 : 0,
      formatResultCssClass: (function(_this) {
        return function(obj) {
          var not_in_collection, _ref;
          if (_this.builder.collection != null) {
            not_in_collection = false;
            if (obj.id === ((_ref = _this.pilot) != null ? _ref.id : void 0)) {
              if (!(_this.builder.collection.checkShelf('pilot', obj.english_name) || _this.builder.collection.checkTable('pilot', obj.english_name))) {
                not_in_collection = true;
              }
            } else {
              not_in_collection = !_this.builder.collection.checkShelf('pilot', obj.english_name);
            }
            if (not_in_collection) {
              return 'select2-result-not-in-collection';
            } else {
              return '';
            }
          } else {
            return '';
          }
        };
      })(this)
    });
    this.pilot_selector.on('change', (function(_this) {
      return function(e) {
        _this.setPilotById(_this.pilot_selector.select2('val'));
        _this.builder.current_squad.dirty = true;
        _this.builder.container.trigger('xwing-backend:squadDirtinessChanged');
        return _this.builder.backend_status.fadeOut('slow');
      };
    })(this));
    this.pilot_selector.data('select2').results.on('mousemove-filtered', (function(_this) {
      return function(e) {
        var select2_data, _ref;
        select2_data = $(e.target).closest('.select2-result').data('select2-data');
        if ((select2_data != null ? select2_data.id : void 0) != null) {
          return _this.builder.showTooltip('Pilot', exportObj.pilotsById[select2_data.id], {
            ship: (_ref = _this.data) != null ? _ref.english_name : void 0
          });
        }
      };
    })(this));
    this.pilot_selector.data('select2').container.on('mouseover', (function(_this) {
      return function(e) {
        if (_this.data != null) {
          return _this.builder.showTooltip('Ship', _this);
        }
      };
    })(this));
    this.pilot_selector.data('select2').container.hide();
    this.points_container = $(this.row.find('.points-display-container'));
    this.points_container.fadeTo(0, 0);
    this.addon_container = $(this.row.find('div.addon-container'));
    this.remove_button = $(this.row.find('button.remove-pilot'));
    this.remove_button.click((function(_this) {
      return function(e) {
        e.preventDefault();
        return _this.row.slideUp('fast', function() {
          var _ref;
          _this.builder.removeShip(_this);
          return (_ref = _this.backend_status) != null ? _ref.fadeOut('slow') : void 0;
        });
      };
    })(this));
    this.remove_button.hide();
    this.copy_button = $(this.row.find('button.copy-pilot'));
    this.copy_button.click((function(_this) {
      return function(e) {
        var clone;
        clone = _this.builder.ships[_this.builder.ships.length - 1];
        return clone.copyFrom(_this);
      };
    })(this));
    return this.copy_button.hide();
  };

  Ship.prototype.teardownUI = function() {
    this.row.text('');
    return this.row.remove();
  };

  Ship.prototype.toString = function() {
    if (this.pilot != null) {
      return "Pilot " + this.pilot.name + " flying " + this.data.name;
    } else {
      return "Ship without pilot";
    }
  };

  Ship.prototype.toHTML = function() {
    var action, action_bar, action_icons, attackHTML, attack_icon, effective_stats, energyHTML, html, modification, slotted_upgrades, title, upgrade, _i, _j, _len, _len1, _ref, _ref1, _ref10, _ref11, _ref12, _ref13, _ref2, _ref3, _ref4, _ref5, _ref6, _ref7, _ref8, _ref9;
    effective_stats = this.effectiveStats();
    action_icons = [];
    _ref = effective_stats.actions;
    for (_i = 0, _len = _ref.length; _i < _len; _i++) {
      action = _ref[_i];
      action_icons.push((function() {
        switch (action) {
          case 'Focus':
            return "<i class=\"xwing-miniatures-font xwing-miniatures-font-focus\"></i>";
          case 'Evade':
            return "<i class=\"xwing-miniatures-font xwing-miniatures-font-evade\"></i>";
          case 'Barrel Roll':
            return "<i class=\"xwing-miniatures-font xwing-miniatures-font-barrelroll\"></i>";
          case 'Target Lock':
            return "<i class=\"xwing-miniatures-font xwing-miniatures-font-targetlock\"></i>";
          case 'Boost':
            return "<i class=\"xwing-miniatures-font xwing-miniatures-font-boost\"></i>";
          case 'Coordinate':
            return "<i class=\"xwing-miniatures-font xwing-miniatures-font-coordinate\"></i>";
          case 'Jam':
            return "<i class=\"xwing-miniatures-font xwing-miniatures-font-jam\"></i>";
          case 'Recover':
            return "<i class=\"xwing-miniatures-font xwing-miniatures-font-recover\"></i>";
          case 'Reinforce':
            return "<i class=\"xwing-miniatures-font xwing-miniatures-font-reinforce\"></i>";
          case 'Cloak':
            return "<i class=\"xwing-miniatures-font xwing-miniatures-font-cloak\"></i>";
          case 'SLAM':
            return "<i class=\"xwing-miniatures-font xwing-miniatures-font-slam\"></i>";
          case 'Rotate Arc':
            return "<i class=\"xwing-miniatures-font xwing-miniatures-font-rotatearc\"></i>";
          default:
            return "<span>&nbsp;" + action + "<span>";
        }
      })());
    }
    action_bar = action_icons.join(' ');
    attack_icon = (_ref1 = this.data.attack_icon) != null ? _ref1 : 'xwing-miniatures-font-attack';
    attackHTML = (((_ref2 = this.pilot.ship_override) != null ? _ref2.attack : void 0) != null) || (this.data.attack != null) ? $.trim("<i class=\"xwing-miniatures-font " + attack_icon + "\"></i>\n<span class=\"info-data info-attack\">" + (statAndEffectiveStat((_ref3 = (_ref4 = this.pilot.ship_override) != null ? _ref4.attack : void 0) != null ? _ref3 : this.data.attack, effective_stats, 'attack')) + "</span>") : '';
    energyHTML = (((_ref5 = this.pilot.ship_override) != null ? _ref5.energy : void 0) != null) || (this.data.energy != null) ? $.trim("<i class=\"xwing-miniatures-font xwing-miniatures-font-energy\"></i>\n<span class=\"info-data info-energy\">" + (statAndEffectiveStat((_ref6 = (_ref7 = this.pilot.ship_override) != null ? _ref7.energy : void 0) != null ? _ref6 : this.data.energy, effective_stats, 'energy')) + "</span>") : '';
    html = $.trim("<div class=\"fancy-pilot-header\">\n    <div class=\"pilot-header-text\">" + this.pilot.name + " <i class=\"xwing-miniatures-ship xwing-miniatures-ship-" + this.data.canonical_name + "\"></i><span class=\"fancy-ship-type\"> " + this.data.name + "</span></div>\n    <div class=\"mask\">\n        <div class=\"outer-circle\">\n            <div class=\"inner-circle pilot-points\">" + this.pilot.points + "</div>\n        </div>\n    </div>\n</div>\n<div class=\"fancy-pilot-stats\">\n    <div class=\"pilot-stats-content\">\n        <span class=\"info-data info-skill\">PS " + (statAndEffectiveStat(this.pilot.skill, effective_stats, 'skill')) + "</span>\n        " + attackHTML + "\n        " + energyHTML + "\n        <i class=\"xwing-miniatures-font xwing-miniatures-font-agility\"></i>\n        <span class=\"info-data info-agility\">" + (statAndEffectiveStat((_ref8 = (_ref9 = this.pilot.ship_override) != null ? _ref9.agility : void 0) != null ? _ref8 : this.data.agility, effective_stats, 'agility')) + "</span>\n        <i class=\"xwing-miniatures-font xwing-miniatures-font-hull\"></i>\n        <span class=\"info-data info-hull\">" + (statAndEffectiveStat((_ref10 = (_ref11 = this.pilot.ship_override) != null ? _ref11.hull : void 0) != null ? _ref10 : this.data.hull, effective_stats, 'hull')) + "</span>\n        <i class=\"xwing-miniatures-font xwing-miniatures-font-shield\"></i>\n        <span class=\"info-data info-shields\">" + (statAndEffectiveStat((_ref12 = (_ref13 = this.pilot.ship_override) != null ? _ref13.shields : void 0) != null ? _ref12 : this.data.shields, effective_stats, 'shields')) + "</span>\n        &nbsp;\n        " + action_bar + "\n    </div>\n</div>");
    if (this.pilot.text) {
      html += $.trim("<div class=\"fancy-pilot-text\">" + this.pilot.text + "</div>");
    }
    slotted_upgrades = ((function() {
      var _j, _len1, _ref14, _results;
      _ref14 = this.upgrades;
      _results = [];
      for (_j = 0, _len1 = _ref14.length; _j < _len1; _j++) {
        upgrade = _ref14[_j];
        if (upgrade.data != null) {
          _results.push(upgrade);
        }
      }
      return _results;
    }).call(this)).concat((function() {
      var _j, _len1, _ref14, _results;
      _ref14 = this.modifications;
      _results = [];
      for (_j = 0, _len1 = _ref14.length; _j < _len1; _j++) {
        modification = _ref14[_j];
        if (modification.data != null) {
          _results.push(modification);
        }
      }
      return _results;
    }).call(this)).concat((function() {
      var _j, _len1, _ref14, _results;
      _ref14 = this.titles;
      _results = [];
      for (_j = 0, _len1 = _ref14.length; _j < _len1; _j++) {
        title = _ref14[_j];
        if (title.data != null) {
          _results.push(title);
        }
      }
      return _results;
    }).call(this));
    if (slotted_upgrades.length > 0) {
      html += $.trim("<div class=\"fancy-upgrade-container\">");
      for (_j = 0, _len1 = slotted_upgrades.length; _j < _len1; _j++) {
        upgrade = slotted_upgrades[_j];
        html += upgrade.toHTML();
      }
      html += $.trim("</div>");
    }
    html += $.trim("<div class=\"ship-points-total\">\n    <strong>Ship Total: " + (this.getPoints()) + "</strong>\n</div>");
    return "<div class=\"fancy-ship\">" + html + "</div>";
  };

  Ship.prototype.toTableRow = function() {
    var modification, slotted_upgrades, table_html, title, upgrade, _i, _len;
    table_html = $.trim("<tr class=\"simple-pilot\">\n    <td class=\"name\">" + this.pilot.name + " &mdash; " + this.data.name + "</td>\n    <td class=\"points\">" + this.pilot.points + "</td>\n</tr>");
    slotted_upgrades = ((function() {
      var _i, _len, _ref, _results;
      _ref = this.upgrades;
      _results = [];
      for (_i = 0, _len = _ref.length; _i < _len; _i++) {
        upgrade = _ref[_i];
        if (upgrade.data != null) {
          _results.push(upgrade);
        }
      }
      return _results;
    }).call(this)).concat((function() {
      var _i, _len, _ref, _results;
      _ref = this.modifications;
      _results = [];
      for (_i = 0, _len = _ref.length; _i < _len; _i++) {
        modification = _ref[_i];
        if (modification.data != null) {
          _results.push(modification);
        }
      }
      return _results;
    }).call(this)).concat((function() {
      var _i, _len, _ref, _results;
      _ref = this.titles;
      _results = [];
      for (_i = 0, _len = _ref.length; _i < _len; _i++) {
        title = _ref[_i];
        if (title.data != null) {
          _results.push(title);
        }
      }
      return _results;
    }).call(this));
    if (slotted_upgrades.length > 0) {
      for (_i = 0, _len = slotted_upgrades.length; _i < _len; _i++) {
        upgrade = slotted_upgrades[_i];
        table_html += upgrade.toTableRow();
      }
    }
    table_html += "<tr class=\"simple-ship-total\"><td colspan=\"2\">Ship Total: " + (this.getPoints()) + "</td></tr>";
    table_html += '<tr><td>&nbsp;</td><td></td></tr>';
    return table_html;
  };

  Ship.prototype.toBBCode = function() {
    var bbcode, bbcode_upgrades, modification, slotted_upgrades, title, upgrade, upgrade_bbcode, _i, _len;
    bbcode = "[b]" + this.pilot.name + " (" + this.pilot.points + ")[/b]";
    slotted_upgrades = ((function() {
      var _i, _len, _ref, _results;
      _ref = this.upgrades;
      _results = [];
      for (_i = 0, _len = _ref.length; _i < _len; _i++) {
        upgrade = _ref[_i];
        if (upgrade.data != null) {
          _results.push(upgrade);
        }
      }
      return _results;
    }).call(this)).concat((function() {
      var _i, _len, _ref, _results;
      _ref = this.modifications;
      _results = [];
      for (_i = 0, _len = _ref.length; _i < _len; _i++) {
        modification = _ref[_i];
        if (modification.data != null) {
          _results.push(modification);
        }
      }
      return _results;
    }).call(this)).concat((function() {
      var _i, _len, _ref, _results;
      _ref = this.titles;
      _results = [];
      for (_i = 0, _len = _ref.length; _i < _len; _i++) {
        title = _ref[_i];
        if (title.data != null) {
          _results.push(title);
        }
      }
      return _results;
    }).call(this));
    if (slotted_upgrades.length > 0) {
      bbcode += "\n";
      bbcode_upgrades = [];
      for (_i = 0, _len = slotted_upgrades.length; _i < _len; _i++) {
        upgrade = slotted_upgrades[_i];
        upgrade_bbcode = upgrade.toBBCode();
        if (upgrade_bbcode != null) {
          bbcode_upgrades.push(upgrade_bbcode);
        }
      }
      bbcode += bbcode_upgrades.join("\n");
    }
    return bbcode;
  };

  Ship.prototype.toSimpleHTML = function() {
    var html, modification, slotted_upgrades, title, upgrade, upgrade_html, _i, _len;
    html = "<b>" + this.pilot.name + " (" + this.pilot.points + ")</b><br />";
    slotted_upgrades = ((function() {
      var _i, _len, _ref, _results;
      _ref = this.upgrades;
      _results = [];
      for (_i = 0, _len = _ref.length; _i < _len; _i++) {
        upgrade = _ref[_i];
        if (upgrade.data != null) {
          _results.push(upgrade);
        }
      }
      return _results;
    }).call(this)).concat((function() {
      var _i, _len, _ref, _results;
      _ref = this.modifications;
      _results = [];
      for (_i = 0, _len = _ref.length; _i < _len; _i++) {
        modification = _ref[_i];
        if (modification.data != null) {
          _results.push(modification);
        }
      }
      return _results;
    }).call(this)).concat((function() {
      var _i, _len, _ref, _results;
      _ref = this.titles;
      _results = [];
      for (_i = 0, _len = _ref.length; _i < _len; _i++) {
        title = _ref[_i];
        if (title.data != null) {
          _results.push(title);
        }
      }
      return _results;
    }).call(this));
    if (slotted_upgrades.length > 0) {
      for (_i = 0, _len = slotted_upgrades.length; _i < _len; _i++) {
        upgrade = slotted_upgrades[_i];
        upgrade_html = upgrade.toSimpleHTML();
        if (upgrade_html != null) {
          html += upgrade_html;
        }
      }
    }
    return html;
  };

  Ship.prototype.toSerialized = function() {
    var addon, conferred_addons, i, modification, serialized_conferred_addons, title, upgrade, upgrades, _i, _j, _k, _l, _len, _len1, _len2, _len3, _ref, _ref1, _ref10, _ref11, _ref2, _ref3, _ref4, _ref5, _ref6, _ref7, _ref8, _ref9;
    conferred_addons = [];
    _ref = this.titles;
    for (_i = 0, _len = _ref.length; _i < _len; _i++) {
      title = _ref[_i];
      conferred_addons = conferred_addons.concat((_ref1 = title != null ? title.conferredAddons : void 0) != null ? _ref1 : []);
    }
    _ref2 = this.modifications;
    for (_j = 0, _len1 = _ref2.length; _j < _len1; _j++) {
      modification = _ref2[_j];
      conferred_addons = conferred_addons.concat((_ref3 = modification != null ? modification.conferredAddons : void 0) != null ? _ref3 : []);
    }
    _ref4 = this.upgrades;
    for (_k = 0, _len2 = _ref4.length; _k < _len2; _k++) {
      upgrade = _ref4[_k];
      conferred_addons = conferred_addons.concat((_ref5 = upgrade != null ? upgrade.conferredAddons : void 0) != null ? _ref5 : []);
    }
    upgrades = "" + ((function() {
      var _l, _len3, _ref6, _ref7, _ref8, _results;
      _ref6 = this.upgrades;
      _results = [];
      for (i = _l = 0, _len3 = _ref6.length; _l < _len3; i = ++_l) {
        upgrade = _ref6[i];
        if (__indexOf.call(conferred_addons, upgrade) < 0) {
          _results.push((_ref7 = upgrade != null ? (_ref8 = upgrade.data) != null ? _ref8.id : void 0 : void 0) != null ? _ref7 : -1);
        }
      }
      return _results;
    }).call(this));
    serialized_conferred_addons = [];
    for (_l = 0, _len3 = conferred_addons.length; _l < _len3; _l++) {
      addon = conferred_addons[_l];
      serialized_conferred_addons.push(addon.toSerialized());
    }
    return [this.pilot.id, upgrades, (_ref6 = (_ref7 = this.titles[0]) != null ? (_ref8 = _ref7.data) != null ? _ref8.id : void 0 : void 0) != null ? _ref6 : -1, (_ref9 = (_ref10 = this.modifications[0]) != null ? (_ref11 = _ref10.data) != null ? _ref11.id : void 0 : void 0) != null ? _ref9 : -1, serialized_conferred_addons.join(',')].join(':');
  };

  Ship.prototype.fromSerialized = function(version, serialized) {
    var addon_cls, addon_id, addon_type_serialized, conferred_addon, conferredaddon_pair, conferredaddon_pairs, deferred_id, deferred_ids, i, modification, modification_conferred_addon_pairs, modification_id, pilot_id, title, title_conferred_addon_pairs, title_conferred_upgrade_ids, title_id, upgrade, upgrade_conferred_addon_pairs, upgrade_id, upgrade_ids, _i, _j, _k, _l, _len, _len1, _len10, _len11, _len12, _len13, _len14, _len15, _len16, _len2, _len3, _len4, _len5, _len6, _len7, _len8, _len9, _m, _n, _o, _p, _q, _r, _ref, _ref1, _ref10, _ref11, _ref12, _ref13, _ref14, _ref15, _ref16, _ref17, _ref2, _ref3, _ref4, _ref5, _ref6, _ref7, _ref8, _ref9, _s, _t, _u, _v, _w, _x, _y;
    switch (version) {
      case 1:
        _ref = serialized.split(':'), pilot_id = _ref[0], upgrade_ids = _ref[1], title_id = _ref[2], title_conferred_upgrade_ids = _ref[3], modification_id = _ref[4];
        this.setPilotById(parseInt(pilot_id));
        _ref1 = upgrade_ids.split(',');
        for (i = _i = 0, _len = _ref1.length; _i < _len; i = ++_i) {
          upgrade_id = _ref1[i];
          upgrade_id = parseInt(upgrade_id);
          if (upgrade_id >= 0) {
            this.upgrades[i].setById(upgrade_id);
          }
        }
        title_id = parseInt(title_id);
        if (title_id >= 0) {
          this.titles[0].setById(title_id);
        }
        if ((this.titles[0] != null) && this.titles[0].conferredAddons.length > 0) {
          _ref2 = title_conferred_upgrade_ids.split(',');
          for (i = _j = 0, _len1 = _ref2.length; _j < _len1; i = ++_j) {
            upgrade_id = _ref2[i];
            upgrade_id = parseInt(upgrade_id);
            if (upgrade_id >= 0) {
              this.titles[0].conferredAddons[i].setById(upgrade_id);
            }
          }
        }
        modification_id = parseInt(modification_id);
        if (modification_id >= 0) {
          this.modifications[0].setById(modification_id);
        }
        break;
      case 2:
      case 3:
        _ref3 = serialized.split(':'), pilot_id = _ref3[0], upgrade_ids = _ref3[1], title_id = _ref3[2], modification_id = _ref3[3], conferredaddon_pairs = _ref3[4];
        this.setPilotById(parseInt(pilot_id));
        deferred_ids = [];
        _ref4 = upgrade_ids.split(',');
        for (i = _k = 0, _len2 = _ref4.length; _k < _len2; i = ++_k) {
          upgrade_id = _ref4[i];
          upgrade_id = parseInt(upgrade_id);
          if (upgrade_id < 0 || isNaN(upgrade_id)) {
            continue;
          }
          if (this.upgrades[i].isOccupied()) {
            deferred_ids.push(upgrade_id);
          } else {
            this.upgrades[i].setById(upgrade_id);
          }
        }
        for (_l = 0, _len3 = deferred_ids.length; _l < _len3; _l++) {
          deferred_id = deferred_ids[_l];
          _ref5 = this.upgrades;
          for (i = _m = 0, _len4 = _ref5.length; _m < _len4; i = ++_m) {
            upgrade = _ref5[i];
            if (upgrade.isOccupied() || upgrade.slot !== exportObj.upgradesById[deferred_id].slot) {
              continue;
            }
            upgrade.setById(deferred_id);
            break;
          }
        }
        title_id = parseInt(title_id);
        if (title_id >= 0) {
          this.titles[0].setById(title_id);
        }
        modification_id = parseInt(modification_id);
        if (modification_id >= 0) {
          this.modifications[0].setById(modification_id);
        }
        if (conferredaddon_pairs != null) {
          conferredaddon_pairs = conferredaddon_pairs.split(',');
        } else {
          conferredaddon_pairs = [];
        }
        if ((this.titles[0] != null) && this.titles[0].conferredAddons.length > 0) {
          title_conferred_addon_pairs = conferredaddon_pairs.splice(0, this.titles[0].conferredAddons.length);
          for (i = _n = 0, _len5 = title_conferred_addon_pairs.length; _n < _len5; i = ++_n) {
            conferredaddon_pair = title_conferred_addon_pairs[i];
            _ref6 = conferredaddon_pair.split('.'), addon_type_serialized = _ref6[0], addon_id = _ref6[1];
            addon_id = parseInt(addon_id);
            addon_cls = SERIALIZATION_CODE_TO_CLASS[addon_type_serialized];
            conferred_addon = this.titles[0].conferredAddons[i];
            if (conferred_addon instanceof addon_cls) {
              conferred_addon.setById(addon_id);
            } else {
              throw new Error("Expected addon class " + addon_cls.constructor.name + " for conferred addon at index " + i + " but " + conferred_addon.constructor.name + " is there");
            }
          }
        }
        _ref7 = this.modifications;
        for (_o = 0, _len6 = _ref7.length; _o < _len6; _o++) {
          modification = _ref7[_o];
          if (((modification != null ? modification.data : void 0) != null) && modification.conferredAddons.length > 0) {
            modification_conferred_addon_pairs = conferredaddon_pairs.splice(0, modification.conferredAddons.length);
            for (i = _p = 0, _len7 = modification_conferred_addon_pairs.length; _p < _len7; i = ++_p) {
              conferredaddon_pair = modification_conferred_addon_pairs[i];
              _ref8 = conferredaddon_pair.split('.'), addon_type_serialized = _ref8[0], addon_id = _ref8[1];
              addon_id = parseInt(addon_id);
              addon_cls = SERIALIZATION_CODE_TO_CLASS[addon_type_serialized];
              conferred_addon = modification.conferredAddons[i];
              if (conferred_addon instanceof addon_cls) {
                conferred_addon.setById(addon_id);
              } else {
                throw new Error("Expected addon class " + addon_cls.constructor.name + " for conferred addon at index " + i + " but " + conferred_addon.constructor.name + " is there");
              }
            }
          }
        }
        break;
      case 4:
        _ref9 = serialized.split(':'), pilot_id = _ref9[0], upgrade_ids = _ref9[1], title_id = _ref9[2], modification_id = _ref9[3], conferredaddon_pairs = _ref9[4];
        this.setPilotById(parseInt(pilot_id));
        deferred_ids = [];
        _ref10 = upgrade_ids.split(',');
        for (i = _q = 0, _len8 = _ref10.length; _q < _len8; i = ++_q) {
          upgrade_id = _ref10[i];
          upgrade_id = parseInt(upgrade_id);
          if (upgrade_id < 0 || isNaN(upgrade_id)) {
            continue;
          }
          if (this.upgrades[i].isOccupied() || (this.upgrades[i].dataById[upgrade_id].also_occupies_upgrades != null)) {
            deferred_ids.push(upgrade_id);
          } else {
            this.upgrades[i].setById(upgrade_id);
          }
        }
        for (_r = 0, _len9 = deferred_ids.length; _r < _len9; _r++) {
          deferred_id = deferred_ids[_r];
          _ref11 = this.upgrades;
          for (i = _s = 0, _len10 = _ref11.length; _s < _len10; i = ++_s) {
            upgrade = _ref11[i];
            if (upgrade.isOccupied() || upgrade.slot !== exportObj.upgradesById[deferred_id].slot) {
              continue;
            }
            upgrade.setById(deferred_id);
            break;
          }
        }
        title_id = parseInt(title_id);
        if (title_id >= 0) {
          this.titles[0].setById(title_id);
        }
        modification_id = parseInt(modification_id);
        if (modification_id >= 0) {
          this.modifications[0].setById(modification_id);
        }
        if (conferredaddon_pairs != null) {
          conferredaddon_pairs = conferredaddon_pairs.split(',');
        } else {
          conferredaddon_pairs = [];
        }
        _ref12 = this.titles;
        for (i = _t = 0, _len11 = _ref12.length; _t < _len11; i = ++_t) {
          title = _ref12[i];
          if (((title != null ? title.data : void 0) != null) && title.conferredAddons.length > 0) {
            title_conferred_addon_pairs = conferredaddon_pairs.splice(0, title.conferredAddons.length);
            for (i = _u = 0, _len12 = title_conferred_addon_pairs.length; _u < _len12; i = ++_u) {
              conferredaddon_pair = title_conferred_addon_pairs[i];
              _ref13 = conferredaddon_pair.split('.'), addon_type_serialized = _ref13[0], addon_id = _ref13[1];
              addon_id = parseInt(addon_id);
              addon_cls = SERIALIZATION_CODE_TO_CLASS[addon_type_serialized];
              conferred_addon = title.conferredAddons[i];
              if (conferred_addon instanceof addon_cls) {
                conferred_addon.setById(addon_id);
              } else {
                throw new Error("Expected addon class " + addon_cls.constructor.name + " for conferred addon at index " + i + " but " + conferred_addon.constructor.name + " is there");
              }
            }
          }
        }
        _ref14 = this.modifications;
        for (_v = 0, _len13 = _ref14.length; _v < _len13; _v++) {
          modification = _ref14[_v];
          if (((modification != null ? modification.data : void 0) != null) && modification.conferredAddons.length > 0) {
            modification_conferred_addon_pairs = conferredaddon_pairs.splice(0, modification.conferredAddons.length);
            for (i = _w = 0, _len14 = modification_conferred_addon_pairs.length; _w < _len14; i = ++_w) {
              conferredaddon_pair = modification_conferred_addon_pairs[i];
              _ref15 = conferredaddon_pair.split('.'), addon_type_serialized = _ref15[0], addon_id = _ref15[1];
              addon_id = parseInt(addon_id);
              addon_cls = SERIALIZATION_CODE_TO_CLASS[addon_type_serialized];
              conferred_addon = modification.conferredAddons[i];
              if (conferred_addon instanceof addon_cls) {
                conferred_addon.setById(addon_id);
              } else {
                throw new Error("Expected addon class " + addon_cls.constructor.name + " for conferred addon at index " + i + " but " + conferred_addon.constructor.name + " is there");
              }
            }
          }
        }
        _ref16 = this.upgrades;
        for (_x = 0, _len15 = _ref16.length; _x < _len15; _x++) {
          upgrade = _ref16[_x];
          if (((upgrade != null ? upgrade.data : void 0) != null) && upgrade.conferredAddons.length > 0) {
            upgrade_conferred_addon_pairs = conferredaddon_pairs.splice(0, upgrade.conferredAddons.length);
            for (i = _y = 0, _len16 = upgrade_conferred_addon_pairs.length; _y < _len16; i = ++_y) {
              conferredaddon_pair = upgrade_conferred_addon_pairs[i];
              _ref17 = conferredaddon_pair.split('.'), addon_type_serialized = _ref17[0], addon_id = _ref17[1];
              addon_id = parseInt(addon_id);
              addon_cls = SERIALIZATION_CODE_TO_CLASS[addon_type_serialized];
              conferred_addon = upgrade.conferredAddons[i];
              if (conferred_addon instanceof addon_cls) {
                conferred_addon.setById(addon_id);
              } else {
                throw new Error("Expected addon class " + addon_cls.constructor.name + " for conferred addon at index " + i + " but " + conferred_addon.constructor.name + " is there");
              }
            }
          }
        }
    }
    return this.updateSelections();
  };

  Ship.prototype.effectiveStats = function() {
    var modification, s, stats, title, upgrade, _i, _j, _k, _l, _len, _len1, _len2, _ref, _ref1, _ref10, _ref11, _ref12, _ref13, _ref14, _ref15, _ref16, _ref17, _ref18, _ref19, _ref2, _ref20, _ref3, _ref4, _ref5, _ref6, _ref7, _ref8, _ref9;
    stats = {
      skill: this.pilot.skill,
      attack: (_ref = (_ref1 = this.pilot.ship_override) != null ? _ref1.attack : void 0) != null ? _ref : this.data.attack,
      energy: (_ref2 = (_ref3 = this.pilot.ship_override) != null ? _ref3.energy : void 0) != null ? _ref2 : this.data.energy,
      agility: (_ref4 = (_ref5 = this.pilot.ship_override) != null ? _ref5.agility : void 0) != null ? _ref4 : this.data.agility,
      hull: (_ref6 = (_ref7 = this.pilot.ship_override) != null ? _ref7.hull : void 0) != null ? _ref6 : this.data.hull,
      shields: (_ref8 = (_ref9 = this.pilot.ship_override) != null ? _ref9.shields : void 0) != null ? _ref8 : this.data.shields,
      actions: ((_ref10 = (_ref11 = this.pilot.ship_override) != null ? _ref11.actions : void 0) != null ? _ref10 : this.data.actions).slice(0)
    };
    stats.maneuvers = [];
    for (s = _i = 0, _ref12 = ((_ref13 = this.data.maneuvers) != null ? _ref13 : []).length; 0 <= _ref12 ? _i < _ref12 : _i > _ref12; s = 0 <= _ref12 ? ++_i : --_i) {
      stats.maneuvers[s] = this.data.maneuvers[s].slice(0);
    }
    _ref14 = this.upgrades;
    for (_j = 0, _len = _ref14.length; _j < _len; _j++) {
      upgrade = _ref14[_j];
      if ((upgrade != null ? (_ref15 = upgrade.data) != null ? _ref15.modifier_func : void 0 : void 0) != null) {
        upgrade.data.modifier_func(stats);
      }
    }
    _ref16 = this.titles;
    for (_k = 0, _len1 = _ref16.length; _k < _len1; _k++) {
      title = _ref16[_k];
      if ((title != null ? (_ref17 = title.data) != null ? _ref17.modifier_func : void 0 : void 0) != null) {
        title.data.modifier_func(stats);
      }
    }
    _ref18 = this.modifications;
    for (_l = 0, _len2 = _ref18.length; _l < _len2; _l++) {
      modification = _ref18[_l];
      if ((modification != null ? (_ref19 = modification.data) != null ? _ref19.modifier_func : void 0 : void 0) != null) {
        modification.data.modifier_func(stats);
      }
    }
    if (((_ref20 = this.pilot) != null ? _ref20.modifier_func : void 0) != null) {
      this.pilot.modifier_func(stats);
    }
    return stats;
  };

  Ship.prototype.validate = function() {
    var func, i, max_checks, modification, title, upgrade, valid, _i, _j, _k, _l, _len, _len1, _len2, _ref, _ref1, _ref10, _ref11, _ref12, _ref13, _ref14, _ref2, _ref3, _ref4, _ref5, _ref6, _ref7, _ref8, _ref9;
    max_checks = 128;
    for (i = _i = 0; 0 <= max_checks ? _i < max_checks : _i > max_checks; i = 0 <= max_checks ? ++_i : --_i) {
      valid = true;
      _ref = this.upgrades;
      for (_j = 0, _len = _ref.length; _j < _len; _j++) {
        upgrade = _ref[_j];
        func = (_ref1 = (_ref2 = upgrade != null ? (_ref3 = upgrade.data) != null ? _ref3.validation_func : void 0 : void 0) != null ? _ref2 : upgrade != null ? (_ref4 = upgrade.data) != null ? _ref4.restriction_func : void 0 : void 0) != null ? _ref1 : void 0;
        if ((func != null) && !func(this, upgrade)) {
          upgrade.setById(null);
          valid = false;
          break;
        }
      }
      _ref5 = this.titles;
      for (_k = 0, _len1 = _ref5.length; _k < _len1; _k++) {
        title = _ref5[_k];
        func = (_ref6 = (_ref7 = title != null ? (_ref8 = title.data) != null ? _ref8.validation_func : void 0 : void 0) != null ? _ref7 : title != null ? (_ref9 = title.data) != null ? _ref9.restriction_func : void 0 : void 0) != null ? _ref6 : void 0;
        if ((func != null) && !func(this)) {
          title.setById(null);
          valid = false;
          break;
        }
      }
      _ref10 = this.modifications;
      for (_l = 0, _len2 = _ref10.length; _l < _len2; _l++) {
        modification = _ref10[_l];
        func = (_ref11 = (_ref12 = modification != null ? (_ref13 = modification.data) != null ? _ref13.validation_func : void 0 : void 0) != null ? _ref12 : modification != null ? (_ref14 = modification.data) != null ? _ref14.restriction_func : void 0 : void 0) != null ? _ref11 : void 0;
        if ((func != null) && !func(this, modification)) {
          modification.setById(null);
          valid = false;
          break;
        }
      }
      if (valid) {
        break;
      }
    }
    return this.updateSelections();
  };

  Ship.prototype.checkUnreleasedContent = function() {
    var modification, title, upgrade, _i, _j, _k, _len, _len1, _len2, _ref, _ref1, _ref2;
    if ((this.pilot != null) && !exportObj.isReleased(this.pilot)) {
      return true;
    }
    _ref = this.titles;
    for (_i = 0, _len = _ref.length; _i < _len; _i++) {
      title = _ref[_i];
      if (((title != null ? title.data : void 0) != null) && !exportObj.isReleased(title.data)) {
        return true;
      }
    }
    _ref1 = this.modifications;
    for (_j = 0, _len1 = _ref1.length; _j < _len1; _j++) {
      modification = _ref1[_j];
      if (((modification != null ? modification.data : void 0) != null) && !exportObj.isReleased(modification.data)) {
        return true;
      }
    }
    _ref2 = this.upgrades;
    for (_k = 0, _len2 = _ref2.length; _k < _len2; _k++) {
      upgrade = _ref2[_k];
      if (((upgrade != null ? upgrade.data : void 0) != null) && !exportObj.isReleased(upgrade.data)) {
        return true;
      }
    }
    return false;
  };

  Ship.prototype.checkEpicContent = function() {
    var modification, title, upgrade, _i, _j, _k, _len, _len1, _len2, _ref, _ref1, _ref2, _ref3, _ref4, _ref5;
    if ((this.pilot != null) && (this.pilot.epic != null)) {
      return true;
    }
    _ref = this.titles;
    for (_i = 0, _len = _ref.length; _i < _len; _i++) {
      title = _ref[_i];
      if ((title != null ? (_ref1 = title.data) != null ? _ref1.epic : void 0 : void 0) != null) {
        return true;
      }
    }
    _ref2 = this.modifications;
    for (_j = 0, _len1 = _ref2.length; _j < _len1; _j++) {
      modification = _ref2[_j];
      if ((modification != null ? (_ref3 = modification.data) != null ? _ref3.epic : void 0 : void 0) != null) {
        return true;
      }
    }
    _ref4 = this.upgrades;
    for (_k = 0, _len2 = _ref4.length; _k < _len2; _k++) {
      upgrade = _ref4[_k];
      if ((upgrade != null ? (_ref5 = upgrade.data) != null ? _ref5.epic : void 0 : void 0) != null) {
        return true;
      }
    }
    return false;
  };

  Ship.prototype.hasAnotherUnoccupiedSlotLike = function(upgrade_obj) {
    var upgrade, _i, _len, _ref;
    _ref = this.upgrades;
    for (_i = 0, _len = _ref.length; _i < _len; _i++) {
      upgrade = _ref[_i];
      if (upgrade === upgrade_obj || upgrade.slot !== upgrade_obj.slot) {
        continue;
      }
      if (!upgrade.isOccupied()) {
        return true;
      }
    }
    return false;
  };

  Ship.prototype.toXWS = function() {
    var modification, title, upgrade, upgrade_obj, xws, _i, _j, _k, _len, _len1, _len2, _ref, _ref1, _ref2;
    xws = {
      name: this.pilot.canonical_name,
      points: this.getPoints(),
      ship: this.data.canonical_name
    };
    if (this.data.multisection) {
      xws.multisection = this.data.multisection.slice(0);
    }
    upgrade_obj = {};
    _ref = this.upgrades;
    for (_i = 0, _len = _ref.length; _i < _len; _i++) {
      upgrade = _ref[_i];
      if ((upgrade != null ? upgrade.data : void 0) != null) {
        upgrade.toXWS(upgrade_obj);
      }
    }
    _ref1 = this.modifications;
    for (_j = 0, _len1 = _ref1.length; _j < _len1; _j++) {
      modification = _ref1[_j];
      if ((modification != null ? modification.data : void 0) != null) {
        modification.toXWS(upgrade_obj);
      }
    }
    _ref2 = this.titles;
    for (_k = 0, _len2 = _ref2.length; _k < _len2; _k++) {
      title = _ref2[_k];
      if ((title != null ? title.data : void 0) != null) {
        title.toXWS(upgrade_obj);
      }
    }
    if (Object.keys(upgrade_obj).length > 0) {
      xws.upgrades = upgrade_obj;
    }
    return xws;
  };

  Ship.prototype.getConditions = function() {
    var condition, conditions, upgrade, _i, _j, _k, _len, _len1, _len2, _ref, _ref1, _ref2, _ref3, _ref4;
    if (typeof Set !== "undefined" && Set !== null) {
      conditions = new Set();
      if (((_ref = this.pilot) != null ? _ref.applies_condition : void 0) != null) {
        if (this.pilot.applies_condition instanceof Array) {
          _ref1 = this.pilot.applies_condition;
          for (_i = 0, _len = _ref1.length; _i < _len; _i++) {
            condition = _ref1[_i];
            conditions.add(exportObj.conditionsByCanonicalName[condition]);
          }
        } else {
          conditions.add(exportObj.conditionsByCanonicalName[this.pilot.applies_condition]);
        }
      }
      _ref2 = this.upgrades;
      for (_j = 0, _len1 = _ref2.length; _j < _len1; _j++) {
        upgrade = _ref2[_j];
        if ((upgrade != null ? (_ref3 = upgrade.data) != null ? _ref3.applies_condition : void 0 : void 0) != null) {
          if (upgrade.data.applies_condition instanceof Array) {
            _ref4 = upgrade.data.applies_condition;
            for (_k = 0, _len2 = _ref4.length; _k < _len2; _k++) {
              condition = _ref4[_k];
              conditions.add(exportObj.conditionsByCanonicalName[condition]);
            }
          } else {
            conditions.add(exportObj.conditionsByCanonicalName[upgrade.data.applies_condition]);
          }
        }
      }
      return conditions;
    } else {
      console.warn('Set not supported in this JS implementation, not implementing conditions');
      return [];
    }
  };

  return Ship;

})();

GenericAddon = (function() {
  function GenericAddon(args) {
    this.ship = args.ship;
    this.container = $(args.container);
    this.data = null;
    this.unadjusted_data = null;
    this.conferredAddons = [];
    this.serialization_code = 'X';
    this.occupied_by = null;
    this.occupying = [];
    this.destroyed = false;
    this.type = null;
    this.dataByName = null;
    this.dataById = null;
    if (args.adjustment_func != null) {
      this.adjustment_func = args.adjustment_func;
    }
    if (args.filter_func != null) {
      this.filter_func = args.filter_func;
    }
    this.placeholderMod_func = args.placeholderMod_func != null ? args.placeholderMod_func : (function(_this) {
      return function(x) {
        return x;
      };
    })(this);
  }

  GenericAddon.prototype.destroy = function() {
    var args, cb, ___iced_passed_deferral, __iced_deferrals, __iced_k;
    __iced_k = __iced_k_noop;
    ___iced_passed_deferral = iced.findDeferral(arguments);
    cb = arguments[0], args = 2 <= arguments.length ? __slice.call(arguments, 1) : [];
    if (this.destroyed) {
      return cb(args);
    }
    (function(_this) {
      return (function(__iced_k) {
        var _ref;
        if (((_ref = _this.data) != null ? _ref.unique : void 0) != null) {
          (function(__iced_k) {
            __iced_deferrals = new iced.Deferrals(__iced_k, {
              parent: ___iced_passed_deferral,
              funcname: "GenericAddon.destroy"
            });
            _this.ship.builder.container.trigger('xwing:releaseUnique', [
              _this.data, _this.type, __iced_deferrals.defer({
                lineno: 20669
              })
            ]);
            __iced_deferrals._fulfill();
          })(__iced_k);
        } else {
          return __iced_k();
        }
      });
    })(this)((function(_this) {
      return function() {
        _this.destroyed = true;
        _this.rescindAddons();
        _this.deoccupyOtherUpgrades();
        _this.selector.select2('destroy');
        return cb(args);
      };
    })(this));
  };

  GenericAddon.prototype.setupSelector = function(args) {
    this.selector = $(document.createElement('INPUT'));
    this.selector.attr('type', 'hidden');
    this.container.append(this.selector);
    if ($.isMobile()) {
      args.minimumResultsForSearch = -1;
    }
    args.formatResultCssClass = (function(_this) {
      return function(obj) {
        var not_in_collection, _ref;
        if (_this.ship.builder.collection != null) {
          not_in_collection = false;
          if (obj.id === ((_ref = _this.data) != null ? _ref.id : void 0)) {
            if (!(_this.ship.builder.collection.checkShelf(_this.type.toLowerCase(), obj.english_name) || _this.ship.builder.collection.checkTable(_this.type.toLowerCase(), obj.english_name))) {
              not_in_collection = true;
            }
          } else {
            not_in_collection = !_this.ship.builder.collection.checkShelf(_this.type.toLowerCase(), obj.english_name);
          }
          if (not_in_collection) {
            return 'select2-result-not-in-collection';
          } else {
            return '';
          }
        } else {
          return '';
        }
      };
    })(this);
    args.formatSelection = (function(_this) {
      return function(obj, container) {
        var icon;
        icon = (function() {
          switch (this.type) {
            case 'Upgrade':
              return this.slot.toLowerCase().replace(/[^0-9a-z]/gi, '');
            default:
              return this.type.toLowerCase().replace(/[^0-9a-z]/gi, '');
          }
        }).call(_this);
        $(container).append("<i class=\"xwing-miniatures-font xwing-miniatures-font-" + icon + "\"></i> " + obj.text);
        return void 0;
      };
    })(this);
    this.selector.select2(args);
    this.selector.on('change', (function(_this) {
      return function(e) {
        _this.setById(_this.selector.select2('val'));
        _this.ship.builder.current_squad.dirty = true;
        _this.ship.builder.container.trigger('xwing-backend:squadDirtinessChanged');
        return _this.ship.builder.backend_status.fadeOut('slow');
      };
    })(this));
    this.selector.data('select2').results.on('mousemove-filtered', (function(_this) {
      return function(e) {
        var select2_data;
        select2_data = $(e.target).closest('.select2-result').data('select2-data');
        if ((select2_data != null ? select2_data.id : void 0) != null) {
          return _this.ship.builder.showTooltip('Addon', _this.dataById[select2_data.id], {
            addon_type: _this.type
          });
        }
      };
    })(this));
    return this.selector.data('select2').container.on('mouseover', (function(_this) {
      return function(e) {
        if (_this.data != null) {
          return _this.ship.builder.showTooltip('Addon', _this.data, {
            addon_type: _this.type
          });
        }
      };
    })(this));
  };

  GenericAddon.prototype.setById = function(id) {
    return this.setData(this.dataById[parseInt(id)]);
  };

  GenericAddon.prototype.setByName = function(name) {
    return this.setData(this.dataByName[$.trim(name)]);
  };

  GenericAddon.prototype.setData = function(new_data) {
    var ___iced_passed_deferral, __iced_deferrals, __iced_k, _ref;
    __iced_k = __iced_k_noop;
    ___iced_passed_deferral = iced.findDeferral(arguments);
    if ((new_data != null ? new_data.id : void 0) !== ((_ref = this.data) != null ? _ref.id : void 0)) {
      (function(_this) {
        return (function(__iced_k) {
          var _ref1;
          if (((_ref1 = _this.data) != null ? _ref1.unique : void 0) != null) {
            (function(__iced_k) {
              __iced_deferrals = new iced.Deferrals(__iced_k, {
                parent: ___iced_passed_deferral,
                funcname: "GenericAddon.setData"
              });
              _this.ship.builder.container.trigger('xwing:releaseUnique', [
                _this.unadjusted_data, _this.type, __iced_deferrals.defer({
                  lineno: 20728
                })
              ]);
              __iced_deferrals._fulfill();
            })(__iced_k);
          } else {
            return __iced_k();
          }
        });
      })(this)((function(_this) {
        return function() {
          _this.rescindAddons();
          _this.deoccupyOtherUpgrades();
          (function(__iced_k) {
            if ((new_data != null ? new_data.unique : void 0) != null) {
              (function(__iced_k) {
                __iced_deferrals = new iced.Deferrals(__iced_k, {
                  parent: ___iced_passed_deferral,
                  funcname: "GenericAddon.setData"
                });
                _this.ship.builder.container.trigger('xwing:claimUnique', [
                  new_data, _this.type, __iced_deferrals.defer({
                    lineno: 20732
                  })
                ]);
                __iced_deferrals._fulfill();
              })(__iced_k);
            } else {
              return __iced_k();
            }
          })(function() {
            _this.data = _this.unadjusted_data = new_data;
            if (_this.data != null) {
              if (_this.data.superseded_by_id) {
                return _this.setById(_this.data.superseded_by_id);
              }
              if (_this.adjustment_func != null) {
                _this.data = _this.adjustment_func(_this.data);
              }
              _this.unequipOtherUpgrades();
              _this.occupyOtherUpgrades();
              _this.conferAddons();
            } else {
              _this.deoccupyOtherUpgrades();
            }
            return __iced_k(_this.ship.builder.container.trigger('xwing:pointsUpdated'));
          });
        };
      })(this));
    } else {
      return __iced_k();
    }
  };

  GenericAddon.prototype.conferAddons = function() {
    var addon, args, cls, _i, _len, _ref, _results;
    if ((this.data.confersAddons != null) && this.data.confersAddons.length > 0) {
      _ref = this.data.confersAddons;
      _results = [];
      for (_i = 0, _len = _ref.length; _i < _len; _i++) {
        addon = _ref[_i];
        cls = addon.type;
        args = {
          ship: this.ship,
          container: this.container
        };
        if (addon.slot != null) {
          args.slot = addon.slot;
        }
        if (addon.adjustment_func != null) {
          args.adjustment_func = addon.adjustment_func;
        }
        if (addon.filter_func != null) {
          args.filter_func = addon.filter_func;
        }
        if (addon.auto_equip != null) {
          args.auto_equip = addon.auto_equip;
        }
        if (addon.placeholderMod_func != null) {
          args.placeholderMod_func = addon.placeholderMod_func;
        }
        addon = new cls(args);
        if (addon instanceof exportObj.Upgrade) {
          this.ship.upgrades.push(addon);
        } else if (addon instanceof exportObj.Modification) {
          this.ship.modifications.push(addon);
        } else if (addon instanceof exportObj.Title) {
          this.ship.titles.push(addon);
        } else {
          throw new Error("Unexpected addon type for addon " + addon);
        }
        _results.push(this.conferredAddons.push(addon));
      }
      return _results;
    }
  };

  GenericAddon.prototype.rescindAddons = function() {
    var addon, ___iced_passed_deferral, __iced_deferrals, __iced_k;
    __iced_k = __iced_k_noop;
    ___iced_passed_deferral = iced.findDeferral(arguments);
    (function(_this) {
      return (function(__iced_k) {
        var _i, _len, _ref;
        __iced_deferrals = new iced.Deferrals(__iced_k, {
          parent: ___iced_passed_deferral,
          funcname: "GenericAddon.rescindAddons"
        });
        _ref = _this.conferredAddons;
        for (_i = 0, _len = _ref.length; _i < _len; _i++) {
          addon = _ref[_i];
          addon.destroy(__iced_deferrals.defer({
            lineno: 20775
          }));
        }
        __iced_deferrals._fulfill();
      });
    })(this)((function(_this) {
      return function() {
        var _i, _len, _ref;
        _ref = _this.conferredAddons;
        for (_i = 0, _len = _ref.length; _i < _len; _i++) {
          addon = _ref[_i];
          if (addon instanceof exportObj.Upgrade) {
            _this.ship.upgrades.removeItem(addon);
          } else if (addon instanceof exportObj.Modification) {
            _this.ship.modifications.removeItem(addon);
          } else if (addon instanceof exportObj.Title) {
            _this.ship.titles.removeItem(addon);
          } else {
            throw new Error("Unexpected addon type for addon " + addon);
          }
        }
        return _this.conferredAddons = [];
      };
    })(this));
  };

  GenericAddon.prototype.getPoints = function() {
    var title, _ref, _ref1, _ref2, _ref3, _ref4;
    if (__indexOf.call((function() {
      var _i, _len, _ref, _ref1, _ref2, _ref3, _results;
      _ref2 = (_ref = (_ref1 = this.ship) != null ? _ref1.titles : void 0) != null ? _ref : [];
      _results = [];
      for (_i = 0, _len = _ref2.length; _i < _len; _i++) {
        title = _ref2[_i];
        _results.push((_ref3 = title.data) != null ? _ref3.canonical_name : void 0);
      }
      return _results;
    }).call(this), 'vaksai') >= 0 && ((_ref = this.data) != null ? _ref.canonical_name : void 0) !== 'vaksai') {
      return Math.max(0, ((_ref1 = (_ref2 = this.data) != null ? _ref2.points : void 0) != null ? _ref1 : 0) - 1);
    } else {
      return (_ref3 = (_ref4 = this.data) != null ? _ref4.points : void 0) != null ? _ref3 : 0;
    }
  };

  GenericAddon.prototype.updateSelection = function() {
    if (this.data != null) {
      return this.selector.select2('data', {
        id: this.data.id,
        text: "" + this.data.name + " (" + this.data.points + ")"
      });
    } else {
      return this.selector.select2('data', null);
    }
  };

  GenericAddon.prototype.toString = function() {
    if (this.data != null) {
      return "" + this.data.name + " (" + this.data.points + ")";
    } else {
      return "No " + this.type;
    }
  };

  GenericAddon.prototype.toHTML = function() {
    var attackHTML, energyHTML, match_array, restriction_html, text_str, upgrade_slot_font, _ref;
    if (this.data != null) {
      upgrade_slot_font = ((_ref = this.data.slot) != null ? _ref : this.type).toLowerCase().replace(/[^0-9a-z]/gi, '');
      match_array = this.data.text.match(/(<span.*<\/span>)<br \/><br \/>(.*)/);
      if (match_array) {
        restriction_html = '<div class="card-restriction-container">' + match_array[1] + '</div>';
        text_str = match_array[2];
      } else {
        restriction_html = '';
        text_str = this.data.text;
      }
      attackHTML = (this.data.attack != null) ? $.trim("<div class=\"upgrade-attack\">\n    <span class=\"upgrade-attack-range\">" + this.data.range + "</span>\n    <span class=\"info-data info-attack\">" + this.data.attack + "</span>\n    <i class=\"xwing-miniatures-font xwing-miniatures-font-attack\"></i>\n</div>") : '';
      energyHTML = (this.data.energy != null) ? $.trim("<div class=\"upgrade-energy\">\n    <span class=\"info-data info-energy\">" + this.data.energy + "</span>\n    <i class=\"xwing-miniatures-font xwing-miniatures-font-energy\"></i>\n</div>") : '';
      return $.trim("<div class=\"upgrade-container\">\n    <div class=\"upgrade-stats\">\n        <div class=\"upgrade-name\"><i class=\"xwing-miniatures-font xwing-miniatures-font-" + upgrade_slot_font + "\"></i>" + this.data.name + "</div>\n        <div class=\"mask\">\n            <div class=\"outer-circle\">\n                <div class=\"inner-circle upgrade-points\">" + this.data.points + "</div>\n            </div>\n        </div>\n        " + restriction_html + "\n    </div>\n    " + attackHTML + "\n    " + energyHTML + "\n    <div class=\"upgrade-text\">" + text_str + "</div>\n    <div style=\"clear: both;\"></div>\n</div>");
    } else {
      return '';
    }
  };

  GenericAddon.prototype.toTableRow = function() {
    if (this.data != null) {
      return $.trim("<tr class=\"simple-addon\">\n    <td class=\"name\">" + this.data.name + "</td>\n    <td class=\"points\">" + this.data.points + "</td>\n</tr>");
    } else {
      return '';
    }
  };

  GenericAddon.prototype.toBBCode = function() {
    if (this.data != null) {
      return "[i]" + this.data.name + " (" + this.data.points + ")[/i]";
    } else {
      return null;
    }
  };

  GenericAddon.prototype.toSimpleHTML = function() {
    if (this.data != null) {
      return "<i>" + this.data.name + " (" + this.data.points + ")</i><br />";
    } else {
      return '';
    }
  };

  GenericAddon.prototype.toSerialized = function() {
    var _ref, _ref1;
    return "" + this.serialization_code + "." + ((_ref = (_ref1 = this.data) != null ? _ref1.id : void 0) != null ? _ref : -1);
  };

  GenericAddon.prototype.unequipOtherUpgrades = function() {
    var modification, slot, upgrade, _i, _j, _k, _len, _len1, _len2, _ref, _ref1, _ref2, _ref3, _ref4, _ref5, _results;
    _ref2 = (_ref = (_ref1 = this.data) != null ? _ref1.unequips_upgrades : void 0) != null ? _ref : [];
    for (_i = 0, _len = _ref2.length; _i < _len; _i++) {
      slot = _ref2[_i];
      _ref3 = this.ship.upgrades;
      for (_j = 0, _len1 = _ref3.length; _j < _len1; _j++) {
        upgrade = _ref3[_j];
        if (upgrade.slot !== slot || upgrade === this || !upgrade.isOccupied()) {
          continue;
        }
        upgrade.setData(null);
        break;
      }
    }
    if ((_ref4 = this.data) != null ? _ref4.unequips_modifications : void 0) {
      _ref5 = this.ship.modifications;
      _results = [];
      for (_k = 0, _len2 = _ref5.length; _k < _len2; _k++) {
        modification = _ref5[_k];
        if (!(modification === this || modification.isOccupied())) {
          continue;
        }
        _results.push(modification.setData(null));
      }
      return _results;
    }
  };

  GenericAddon.prototype.isOccupied = function() {
    return (this.data != null) || (this.occupied_by != null);
  };

  GenericAddon.prototype.occupyOtherUpgrades = function() {
    var modification, slot, upgrade, _i, _j, _k, _len, _len1, _len2, _ref, _ref1, _ref2, _ref3, _ref4, _ref5, _results;
    _ref2 = (_ref = (_ref1 = this.data) != null ? _ref1.also_occupies_upgrades : void 0) != null ? _ref : [];
    for (_i = 0, _len = _ref2.length; _i < _len; _i++) {
      slot = _ref2[_i];
      _ref3 = this.ship.upgrades;
      for (_j = 0, _len1 = _ref3.length; _j < _len1; _j++) {
        upgrade = _ref3[_j];
        if (upgrade.slot !== slot || upgrade === this || upgrade.isOccupied()) {
          continue;
        }
        this.occupy(upgrade);
        break;
      }
    }
    if ((_ref4 = this.data) != null ? _ref4.also_occupies_modifications : void 0) {
      _ref5 = this.ship.modifications;
      _results = [];
      for (_k = 0, _len2 = _ref5.length; _k < _len2; _k++) {
        modification = _ref5[_k];
        if (modification === this || modification.isOccupied()) {
          continue;
        }
        _results.push(this.occupy(modification));
      }
      return _results;
    }
  };

  GenericAddon.prototype.deoccupyOtherUpgrades = function() {
    var upgrade, _i, _len, _ref, _results;
    _ref = this.occupying;
    _results = [];
    for (_i = 0, _len = _ref.length; _i < _len; _i++) {
      upgrade = _ref[_i];
      _results.push(this.deoccupy(upgrade));
    }
    return _results;
  };

  GenericAddon.prototype.occupy = function(upgrade) {
    upgrade.occupied_by = this;
    upgrade.selector.select2('enable', false);
    return this.occupying.push(upgrade);
  };

  GenericAddon.prototype.deoccupy = function(upgrade) {
    upgrade.occupied_by = null;
    return upgrade.selector.select2('enable', true);
  };

  GenericAddon.prototype.occupiesAnotherUpgradeSlot = function() {
    var upgrade, _i, _len, _ref;
    _ref = this.ship.upgrades;
    for (_i = 0, _len = _ref.length; _i < _len; _i++) {
      upgrade = _ref[_i];
      if (upgrade.slot !== this.slot || upgrade === this || (upgrade.data != null)) {
        continue;
      }
      if ((upgrade.occupied_by != null) && upgrade.occupied_by === this) {
        return true;
      }
    }
    return false;
  };

  GenericAddon.prototype.toXWS = function(upgrade_dict) {
    var upgrade_type;
    upgrade_type = (function() {
      var _ref, _ref1;
      switch (this.type) {
        case 'Upgrade':
          return (_ref = exportObj.toXWSUpgrade[this.slot]) != null ? _ref : this.slot.canonicalize();
        default:
          return (_ref1 = exportObj.toXWSUpgrade[this.type]) != null ? _ref1 : this.type.canonicalize();
      }
    }).call(this);
    return (upgrade_dict[upgrade_type] != null ? upgrade_dict[upgrade_type] : upgrade_dict[upgrade_type] = []).push(this.data.canonical_name);
  };

  return GenericAddon;

})();

exportObj.Upgrade = (function(_super) {
  __extends(Upgrade, _super);

  function Upgrade(args) {
    Upgrade.__super__.constructor.call(this, args);
    this.slot = args.slot;
    this.type = 'Upgrade';
    this.dataById = exportObj.upgradesById;
    this.dataByName = exportObj.upgradesByLocalizedName;
    this.serialization_code = 'U';
    this.setupSelector();
  }

  Upgrade.prototype.setupSelector = function() {
    return Upgrade.__super__.setupSelector.call(this, {
      width: '50%',
      placeholder: this.placeholderMod_func(exportObj.translate(this.ship.builder.language, 'ui', 'upgradePlaceholder', this.slot)),
      allowClear: true,
      query: (function(_this) {
        return function(query) {
          _this.ship.builder.checkCollection();
          return query.callback({
            more: false,
            results: _this.ship.builder.getAvailableUpgradesIncluding(_this.slot, _this.data, _this.ship, _this, query.term, _this.filter_func)
          });
        };
      })(this)
    });
  };

  return Upgrade;

})(GenericAddon);

exportObj.Modification = (function(_super) {
  __extends(Modification, _super);

  function Modification(args) {
    Modification.__super__.constructor.call(this, args);
    this.type = 'Modification';
    this.dataById = exportObj.modificationsById;
    this.dataByName = exportObj.modificationsByLocalizedName;
    this.serialization_code = 'M';
    this.setupSelector();
  }

  Modification.prototype.setupSelector = function() {
    return Modification.__super__.setupSelector.call(this, {
      width: '50%',
      placeholder: this.placeholderMod_func(exportObj.translate(this.ship.builder.language, 'ui', 'modificationPlaceholder')),
      allowClear: true,
      query: (function(_this) {
        return function(query) {
          _this.ship.builder.checkCollection();
          return query.callback({
            more: false,
            results: _this.ship.builder.getAvailableModificationsIncluding(_this.data, _this.ship, query.term, _this.filter_func)
          });
        };
      })(this)
    });
  };

  return Modification;

})(GenericAddon);

exportObj.Title = (function(_super) {
  __extends(Title, _super);

  function Title(args) {
    Title.__super__.constructor.call(this, args);
    this.type = 'Title';
    this.dataById = exportObj.titlesById;
    this.dataByName = exportObj.titlesByLocalizedName;
    this.serialization_code = 'T';
    this.setupSelector();
  }

  Title.prototype.setupSelector = function() {
    return Title.__super__.setupSelector.call(this, {
      width: '50%',
      placeholder: this.placeholderMod_func(exportObj.translate(this.ship.builder.language, 'ui', 'titlePlaceholder')),
      allowClear: true,
      query: (function(_this) {
        return function(query) {
          _this.ship.builder.checkCollection();
          return query.callback({
            more: false,
            results: _this.ship.builder.getAvailableTitlesIncluding(_this.ship, _this.data, query.term)
          });
        };
      })(this)
    });
  };

  return Title;

})(GenericAddon);

exportObj.RestrictedUpgrade = (function(_super) {
  __extends(RestrictedUpgrade, _super);

  function RestrictedUpgrade(args) {
    this.filter_func = args.filter_func;
    RestrictedUpgrade.__super__.constructor.call(this, args);
    this.serialization_code = 'u';
    if (args.auto_equip != null) {
      this.setById(args.auto_equip);
    }
  }

  return RestrictedUpgrade;

})(exportObj.Upgrade);

exportObj.RestrictedModification = (function(_super) {
  __extends(RestrictedModification, _super);

  function RestrictedModification(args) {
    this.filter_func = args.filter_func;
    RestrictedModification.__super__.constructor.call(this, args);
    this.serialization_code = 'm';
    if (args.auto_equip != null) {
      this.setById(args.auto_equip);
    }
  }

  return RestrictedModification;

})(exportObj.Modification);

SERIALIZATION_CODE_TO_CLASS = {
  'M': exportObj.Modification,
  'T': exportObj.Title,
  'U': exportObj.Upgrade,
  'u': exportObj.RestrictedUpgrade,
  'm': exportObj.RestrictedModification
};

exportObj = typeof exports !== "undefined" && exports !== null ? exports : this;

exportObj.fromXWSFaction = {
  'rebel': 'Rebel Alliance',
  'rebels': 'Rebel Alliance',
  'empire': 'Galactic Empire',
  'imperial': 'Galactic Empire',
  'scum': 'Scum and Villainy'
};

exportObj.toXWSFaction = {
  'Rebel Alliance': 'rebel',
  'Galactic Empire': 'imperial',
  'Scum and Villainy': 'scum'
};

exportObj.toXWSUpgrade = {
  'Astromech': 'amd',
  'Elite': 'ept',
  'Modification': 'mod',
  'Salvaged Astromech': 'samd'
};

exportObj.fromXWSUpgrade = {
  'amd': 'Astromech',
  'astromechdroid': 'Astromech',
  'ept': 'Elite',
  'elitepilottalent': 'Elite',
  'mod': 'Modification',
  'samd': 'Salvaged Astromech'
};

SPEC_URL = 'https://github.com/elistevens/xws-spec';

exportObj.XWSManager = (function() {
  function XWSManager(args) {
    this.container = $(args.container);
    this.setupUI();
    this.setupHandlers();
  }

  XWSManager.prototype.setupUI = function() {
    this.container.addClass('hidden-print');
    this.container.html($.trim("<div class=\"row-fluid\">\n    <div class=\"span9\">\n    </div>\n</div>"));
    this.xws_export_modal = $(document.createElement('DIV'));
    this.xws_export_modal.addClass('modal hide fade xws-modal hidden-print');
    this.container.append(this.xws_export_modal);
    this.xws_export_modal.append($.trim("<div class=\"modal-header\">\n    <button type=\"button\" class=\"close hidden-print\" data-dismiss=\"modal\" aria-hidden=\"true\">&times;</button>\n    <h3>XWS Export (Beta!)</h3>\n</div>\n<div class=\"modal-body\">\n    <ul class=\"nav nav-pills\">\n        <li><a id=\"xws-text-tab\" href=\"#xws-text\" data-toggle=\"tab\">Text</a></li>\n        <li><a id=\"xws-qrcode-tab\" href=\"#xws-qrcode\" data-toggle=\"tab\">QR Code</a></li>\n    </ul>\n    <div class=\"tab-content\">\n        <div class=\"tab-pane\" id=\"xws-text\">\n            Copy and paste this into an XWS-compliant application to transfer your list.\n            <i>(This is in beta, and the <a href=\"" + SPEC_URL + "\">spec</a> is still being defined, so it may not work!)</i>\n            <div class=\"container-fluid\">\n                <textarea class=\"xws-content\"></textarea>\n            </div>\n        </div>\n        <div class=\"tab-pane\" id=\"xws-qrcode\">\n            Below is a QR Code of XWS.  <i>This is still very experimental!</i>\n            <div id=\"xws-qrcode-container\"></div>\n        </div>\n    </div>\n</div>\n<div class=\"modal-footer hidden-print\">\n    <button class=\"btn\" data-dismiss=\"modal\" aria-hidden=\"true\">Close</button>\n</div>"));
    this.xws_import_modal = $(document.createElement('DIV'));
    this.xws_import_modal.addClass('modal hide fade xws-modal hidden-print');
    this.container.append(this.xws_import_modal);
    return this.xws_import_modal.append($.trim("<div class=\"modal-header\">\n    <button type=\"button\" class=\"close hidden-print\" data-dismiss=\"modal\" aria-hidden=\"true\">&times;</button>\n    <h3>XWS Import (Beta!)</h3>\n</div>\n<div class=\"modal-body\">\n    Paste XWS here to load a list exported from another application.\n    <i>(This is in beta, and the <a href=\"" + SPEC_URL + "\">spec</a> is still being defined, so it may not work!)</i>\n    <div class=\"container-fluid\">\n        <textarea class=\"xws-content\" placeholder=\"Paste XWS here...\"></textarea>\n    </div>\n</div>\n<div class=\"modal-footer hidden-print\">\n    <span class=\"xws-import-status\"></span>&nbsp;\n    <button class=\"btn btn-primary import-xws\">Import It!</button>\n    <button class=\"btn\" data-dismiss=\"modal\" aria-hidden=\"true\">Close</button>\n</div>"));
  };

  XWSManager.prototype.setupHandlers = function() {
    this.from_xws_button = this.container.find('button.from-xws');
    this.from_xws_button.click((function(_this) {
      return function(e) {
        e.preventDefault();
        return _this.xws_import_modal.modal('show');
      };
    })(this));
    this.to_xws_button = this.container.find('button.to-xws');
    this.to_xws_button.click((function(_this) {
      return function(e) {
        e.preventDefault();
        return $(window).trigger('xwing:pingActiveBuilder', function(builder) {
          var textarea;
          textarea = $(_this.xws_export_modal.find('.xws-content'));
          textarea.attr('readonly');
          textarea.val(JSON.stringify(builder.toXWS()));
          $('#xws-qrcode-container').text('');
          $('#xws-qrcode-container').qrcode({
            render: 'canvas',
            text: JSON.stringify(builder.toMinimalXWS()),
            ec: 'L',
            size: 256
          });
          _this.xws_export_modal.modal('show');
          $('#xws-text-tab').tab('show');
          textarea.select();
          return textarea.focus();
        });
      };
    })(this));
    $('#xws-qrcode-container').click(function(e) {
      return window.open($('#xws-qrcode-container canvas')[0].toDataURL());
    });
    this.load_xws_button = $(this.xws_import_modal.find('button.import-xws'));
    return this.load_xws_button.click((function(_this) {
      return function(e) {
        var import_status;
        e.preventDefault();
        import_status = $(_this.xws_import_modal.find('.xws-import-status'));
        import_status.text('Loading...');
        return (function(import_status) {
          var xws;
          try {
            xws = JSON.parse(_this.xws_import_modal.find('.xws-content').val());
          } catch (_error) {
            e = _error;
            import_status.text('Invalid JSON');
            return;
          }
          return (function(xws) {
            return $(window).trigger('xwing:activateBuilder', [
              exportObj.fromXWSFaction[xws.faction], function(builder) {
                if (builder.current_squad.dirty && (builder.backend != null)) {
                  _this.xws_import_modal.modal('hide');
                  return builder.backend.warnUnsaved(builder, function() {
                    return builder.loadFromXWS(xws, function(res) {
                      if (!res.success) {
                        _this.xws_import_modal.modal('show');
                        return import_status.text(res.error);
                      }
                    });
                  });
                } else {
                  return builder.loadFromXWS(xws, function(res) {
                    if (res.success) {
                      return _this.xws_import_modal.modal('hide');
                    } else {
                      return import_status.text(res.error);
                    }
                  });
                }
              }
            ]);
          })(xws);
        })(import_status);
      };
    })(this));
  };

  return XWSManager;

})();

/*
//@ sourceMappingURL=xwing.js.map
*/