(function (fs, path$1, os, util, events, assert) {
    'use strict';

    fs = fs && fs.hasOwnProperty('default') ? fs['default'] : fs;
    path$1 = path$1 && path$1.hasOwnProperty('default') ? path$1['default'] : path$1;
    os = os && os.hasOwnProperty('default') ? os['default'] : os;
    util = util && util.hasOwnProperty('default') ? util['default'] : util;
    events = events && events.hasOwnProperty('default') ? events['default'] : events;
    assert = assert && assert.hasOwnProperty('default') ? assert['default'] : assert;

    var concatMap = function (xs, fn) {
      var res = [];

      for (var i = 0; i < xs.length; i++) {
        var x = fn(xs[i], i);
        if (isArray(x)) res.push.apply(res, x);else res.push(x);
      }

      return res;
    };

    var isArray = Array.isArray || function (xs) {
      return Object.prototype.toString.call(xs) === '[object Array]';
    };

    'use strict';

    var balancedMatch = balanced;

    function balanced(a, b, str) {
      if (a instanceof RegExp) a = maybeMatch(a, str);
      if (b instanceof RegExp) b = maybeMatch(b, str);
      var r = range(a, b, str);
      return r && {
        start: r[0],
        end: r[1],
        pre: str.slice(0, r[0]),
        body: str.slice(r[0] + a.length, r[1]),
        post: str.slice(r[1] + b.length)
      };
    }

    function maybeMatch(reg, str) {
      var m = str.match(reg);
      return m ? m[0] : null;
    }

    balanced.range = range;

    function range(a, b, str) {
      var begs, beg, left, right, result;
      var ai = str.indexOf(a);
      var bi = str.indexOf(b, ai + 1);
      var i = ai;

      if (ai >= 0 && bi > 0) {
        begs = [];
        left = str.length;

        while (i >= 0 && !result) {
          if (i == ai) {
            begs.push(i);
            ai = str.indexOf(a, i + 1);
          } else if (begs.length == 1) {
            result = [begs.pop(), bi];
          } else {
            beg = begs.pop();

            if (beg < left) {
              left = beg;
              right = bi;
            }

            bi = str.indexOf(b, i + 1);
          }

          i = ai < bi && ai >= 0 ? ai : bi;
        }

        if (begs.length) {
          result = [left, right];
        }
      }

      return result;
    }

    var braceExpansion = expandTop;
    var escSlash = '\0SLASH' + Math.random() + '\0';
    var escOpen = '\0OPEN' + Math.random() + '\0';
    var escClose = '\0CLOSE' + Math.random() + '\0';
    var escComma = '\0COMMA' + Math.random() + '\0';
    var escPeriod = '\0PERIOD' + Math.random() + '\0';

    function numeric(str) {
      return parseInt(str, 10) == str ? parseInt(str, 10) : str.charCodeAt(0);
    }

    function escapeBraces(str) {
      return str.split('\\\\').join(escSlash).split('\\{').join(escOpen).split('\\}').join(escClose).split('\\,').join(escComma).split('\\.').join(escPeriod);
    }

    function unescapeBraces(str) {
      return str.split(escSlash).join('\\').split(escOpen).join('{').split(escClose).join('}').split(escComma).join(',').split(escPeriod).join('.');
    } // Basically just str.split(","), but handling cases
    // where we have nested braced sections, which should be
    // treated as individual members, like {a,{b,c},d}


    function parseCommaParts(str) {
      if (!str) return [''];
      var parts = [];
      var m = balancedMatch('{', '}', str);
      if (!m) return str.split(',');
      var pre = m.pre;
      var body = m.body;
      var post = m.post;
      var p = pre.split(',');
      p[p.length - 1] += '{' + body + '}';
      var postParts = parseCommaParts(post);

      if (post.length) {
        p[p.length - 1] += postParts.shift();
        p.push.apply(p, postParts);
      }

      parts.push.apply(parts, p);
      return parts;
    }

    function expandTop(str) {
      if (!str) return []; // I don't know why Bash 4.3 does this, but it does.
      // Anything starting with {} will have the first two bytes preserved
      // but *only* at the top level, so {},a}b will not expand to anything,
      // but a{},b}c will be expanded to [a}c,abc].
      // One could argue that this is a bug in Bash, but since the goal of
      // this module is to match Bash's rules, we escape a leading {}

      if (str.substr(0, 2) === '{}') {
        str = '\\{\\}' + str.substr(2);
      }

      return expand(escapeBraces(str), true).map(unescapeBraces);
    }

    function identity(e) {
      return e;
    }

    function embrace(str) {
      return '{' + str + '}';
    }

    function isPadded(el) {
      return /^-?0\d/.test(el);
    }

    function lte(i, y) {
      return i <= y;
    }

    function gte(i, y) {
      return i >= y;
    }

    function expand(str, isTop) {
      var expansions = [];
      var m = balancedMatch('{', '}', str);
      if (!m || /\$$/.test(m.pre)) return [str];
      var isNumericSequence = /^-?\d+\.\.-?\d+(?:\.\.-?\d+)?$/.test(m.body);
      var isAlphaSequence = /^[a-zA-Z]\.\.[a-zA-Z](?:\.\.-?\d+)?$/.test(m.body);
      var isSequence = isNumericSequence || isAlphaSequence;
      var isOptions = m.body.indexOf(',') >= 0;

      if (!isSequence && !isOptions) {
        // {a},b}
        if (m.post.match(/,.*\}/)) {
          str = m.pre + '{' + m.body + escClose + m.post;
          return expand(str);
        }

        return [str];
      }

      var n;

      if (isSequence) {
        n = m.body.split(/\.\./);
      } else {
        n = parseCommaParts(m.body);

        if (n.length === 1) {
          // x{{a,b}}y ==> x{a}y x{b}y
          n = expand(n[0], false).map(embrace);

          if (n.length === 1) {
            var post = m.post.length ? expand(m.post, false) : [''];
            return post.map(function (p) {
              return m.pre + n[0] + p;
            });
          }
        }
      } // at this point, n is the parts, and we know it's not a comma set
      // with a single entry.
      // no need to expand pre, since it is guaranteed to be free of brace-sets


      var pre = m.pre;
      var post = m.post.length ? expand(m.post, false) : [''];
      var N;

      if (isSequence) {
        var x = numeric(n[0]);
        var y = numeric(n[1]);
        var width = Math.max(n[0].length, n[1].length);
        var incr = n.length == 3 ? Math.abs(numeric(n[2])) : 1;
        var test = lte;
        var reverse = y < x;

        if (reverse) {
          incr *= -1;
          test = gte;
        }

        var pad = n.some(isPadded);
        N = [];

        for (var i = x; test(i, y); i += incr) {
          var c;

          if (isAlphaSequence) {
            c = String.fromCharCode(i);
            if (c === '\\') c = '';
          } else {
            c = String(i);

            if (pad) {
              var need = width - c.length;

              if (need > 0) {
                var z = new Array(need + 1).join('0');
                if (i < 0) c = '-' + z + c.slice(1);else c = z + c;
              }
            }
          }

          N.push(c);
        }
      } else {
        N = concatMap(n, function (el) {
          return expand(el, false);
        });
      }

      for (var j = 0; j < N.length; j++) {
        for (var k = 0; k < post.length; k++) {
          var expansion = pre + N[j] + post[k];
          if (!isTop || isSequence || expansion) expansions.push(expansion);
        }
      }

      return expansions;
    }

    var minimatch_1 = minimatch;
    minimatch.Minimatch = Minimatch;
    var path = {
      sep: '/'
    };

    try {
      path = path$1;
    } catch (er) {}

    var GLOBSTAR = minimatch.GLOBSTAR = Minimatch.GLOBSTAR = {};
    var plTypes = {
      '!': {
        open: '(?:(?!(?:',
        close: '))[^/]*?)'
      },
      '?': {
        open: '(?:',
        close: ')?'
      },
      '+': {
        open: '(?:',
        close: ')+'
      },
      '*': {
        open: '(?:',
        close: ')*'
      },
      '@': {
        open: '(?:',
        close: ')'
      } // any single thing other than /
      // don't need to escape / when using new RegExp()

    };
    var qmark = '[^/]'; // * => any number of characters

    var star = qmark + '*?'; // ** when dots are allowed.  Anything goes, except .. and .
    // not (^ or / followed by one or two dots followed by $ or /),
    // followed by anything, any number of times.

    var twoStarDot = '(?:(?!(?:\\\/|^)(?:\\.{1,2})($|\\\/)).)*?'; // not a ^ or / followed by a dot,
    // followed by anything, any number of times.

    var twoStarNoDot = '(?:(?!(?:\\\/|^)\\.).)*?'; // characters that need to be escaped in RegExp.

    var reSpecials = charSet('().*{}+?[]^$\\!'); // "abc" -> { a:true, b:true, c:true }

    function charSet(s) {
      return s.split('').reduce(function (set, c) {
        set[c] = true;
        return set;
      }, {});
    } // normalizes slashes.


    var slashSplit = /\/+/;
    minimatch.filter = filter;

    function filter(pattern, options) {
      options = options || {};
      return function (p, i, list) {
        return minimatch(p, pattern, options);
      };
    }

    function ext(a, b) {
      a = a || {};
      b = b || {};
      var t = {};
      Object.keys(b).forEach(function (k) {
        t[k] = b[k];
      });
      Object.keys(a).forEach(function (k) {
        t[k] = a[k];
      });
      return t;
    }

    minimatch.defaults = function (def) {
      if (!def || !Object.keys(def).length) return minimatch;
      var orig = minimatch;

      var m = function minimatch(p, pattern, options) {
        return orig.minimatch(p, pattern, ext(def, options));
      };

      m.Minimatch = function Minimatch(pattern, options) {
        return new orig.Minimatch(pattern, ext(def, options));
      };

      return m;
    };

    Minimatch.defaults = function (def) {
      if (!def || !Object.keys(def).length) return Minimatch;
      return minimatch.defaults(def).Minimatch;
    };

    function minimatch(p, pattern, options) {
      if (typeof pattern !== 'string') {
        throw new TypeError('glob pattern string required');
      }

      if (!options) options = {}; // shortcut: comments match nothing.

      if (!options.nocomment && pattern.charAt(0) === '#') {
        return false;
      } // "" only matches ""


      if (pattern.trim() === '') return p === '';
      return new Minimatch(pattern, options).match(p);
    }

    function Minimatch(pattern, options) {
      if (!(this instanceof Minimatch)) {
        return new Minimatch(pattern, options);
      }

      if (typeof pattern !== 'string') {
        throw new TypeError('glob pattern string required');
      }

      if (!options) options = {};
      pattern = pattern.trim(); // windows support: need to use /, not \

      if (path.sep !== '/') {
        pattern = pattern.split(path.sep).join('/');
      }

      this.options = options;
      this.set = [];
      this.pattern = pattern;
      this.regexp = null;
      this.negate = false;
      this.comment = false;
      this.empty = false; // make the set of regexps etc.

      this.make();
    }

    Minimatch.prototype.debug = function () {};

    Minimatch.prototype.make = make;

    function make() {
      // don't do it more than once.
      if (this._made) return;
      var pattern = this.pattern;
      var options = this.options; // empty patterns and comments match nothing.

      if (!options.nocomment && pattern.charAt(0) === '#') {
        this.comment = true;
        return;
      }

      if (!pattern) {
        this.empty = true;
        return;
      } // step 1: figure out negation, etc.


      this.parseNegate(); // step 2: expand braces

      var set = this.globSet = this.braceExpand();
      if (options.debug) this.debug = console.error;
      this.debug(this.pattern, set); // step 3: now we have a set, so turn each one into a series of path-portion
      // matching patterns.
      // These will be regexps, except in the case of "**", which is
      // set to the GLOBSTAR object for globstar behavior,
      // and will not contain any / characters

      set = this.globParts = set.map(function (s) {
        return s.split(slashSplit);
      });
      this.debug(this.pattern, set); // glob --> regexps

      set = set.map(function (s, si, set) {
        return s.map(this.parse, this);
      }, this);
      this.debug(this.pattern, set); // filter out everything that didn't compile properly.

      set = set.filter(function (s) {
        return s.indexOf(false) === -1;
      });
      this.debug(this.pattern, set);
      this.set = set;
    }

    Minimatch.prototype.parseNegate = parseNegate;

    function parseNegate() {
      var pattern = this.pattern;
      var negate = false;
      var options = this.options;
      var negateOffset = 0;
      if (options.nonegate) return;

      for (var i = 0, l = pattern.length; i < l && pattern.charAt(i) === '!'; i++) {
        negate = !negate;
        negateOffset++;
      }

      if (negateOffset) this.pattern = pattern.substr(negateOffset);
      this.negate = negate;
    } // Brace expansion:
    // a{b,c}d -> abd acd
    // a{b,}c -> abc ac
    // a{0..3}d -> a0d a1d a2d a3d
    // a{b,c{d,e}f}g -> abg acdfg acefg
    // a{b,c}d{e,f}g -> abdeg acdeg abdeg abdfg
    //
    // Invalid sets are not expanded.
    // a{2..}b -> a{2..}b
    // a{b}c -> a{b}c


    minimatch.braceExpand = function (pattern, options) {
      return braceExpand(pattern, options);
    };

    Minimatch.prototype.braceExpand = braceExpand;

    function braceExpand(pattern, options) {
      if (!options) {
        if (this instanceof Minimatch) {
          options = this.options;
        } else {
          options = {};
        }
      }

      pattern = typeof pattern === 'undefined' ? this.pattern : pattern;

      if (typeof pattern === 'undefined') {
        throw new TypeError('undefined pattern');
      }

      if (options.nobrace || !pattern.match(/\{.*\}/)) {
        // shortcut. no need to expand.
        return [pattern];
      }

      return braceExpansion(pattern);
    } // parse a component of the expanded set.
    // At this point, no pattern may contain "/" in it
    // so we're going to return a 2d array, where each entry is the full
    // pattern, split on '/', and then turned into a regular expression.
    // A regexp is made at the end which joins each array with an
    // escaped /, and another full one which joins each regexp with |.
    //
    // Following the lead of Bash 4.1, note that "**" only has special meaning
    // when it is the *only* thing in a path portion.  Otherwise, any series
    // of * is equivalent to a single *.  Globstar behavior is enabled by
    // default, and can be disabled by setting options.noglobstar.


    Minimatch.prototype.parse = parse;
    var SUBPARSE = {};

    function parse(pattern, isSub) {
      if (pattern.length > 1024 * 64) {
        throw new TypeError('pattern is too long');
      }

      var options = this.options; // shortcuts

      if (!options.noglobstar && pattern === '**') return GLOBSTAR;
      if (pattern === '') return '';
      var re = '';
      var hasMagic = !!options.nocase;
      var escaping = false; // ? => one single character

      var patternListStack = [];
      var negativeLists = [];
      var stateChar;
      var inClass = false;
      var reClassStart = -1;
      var classStart = -1; // . and .. never match anything that doesn't start with .,
      // even when options.dot is set.

      var patternStart = pattern.charAt(0) === '.' ? '' // anything
      // not (start or / followed by . or .. followed by / or end)
      : options.dot ? '(?!(?:^|\\\/)\\.{1,2}(?:$|\\\/))' : '(?!\\.)';
      var self = this;

      function clearStateChar() {
        if (stateChar) {
          // we had some state-tracking character
          // that wasn't consumed by this pass.
          switch (stateChar) {
            case '*':
              re += star;
              hasMagic = true;
              break;

            case '?':
              re += qmark;
              hasMagic = true;
              break;

            default:
              re += '\\' + stateChar;
              break;
          }

          self.debug('clearStateChar %j %j', stateChar, re);
          stateChar = false;
        }
      }

      for (var i = 0, len = pattern.length, c; i < len && (c = pattern.charAt(i)); i++) {
        this.debug('%s\t%s %s %j', pattern, i, re, c); // skip over any that are escaped.

        if (escaping && reSpecials[c]) {
          re += '\\' + c;
          escaping = false;
          continue;
        }

        switch (c) {
          case '/':
            // completely not allowed, even escaped.
            // Should already be path-split by now.
            return false;

          case '\\':
            clearStateChar();
            escaping = true;
            continue;
          // the various stateChar values
          // for the "extglob" stuff.

          case '?':
          case '*':
          case '+':
          case '@':
          case '!':
            this.debug('%s\t%s %s %j <-- stateChar', pattern, i, re, c); // all of those are literals inside a class, except that
            // the glob [!a] means [^a] in regexp

            if (inClass) {
              this.debug('  in class');
              if (c === '!' && i === classStart + 1) c = '^';
              re += c;
              continue;
            } // if we already have a stateChar, then it means
            // that there was something like ** or +? in there.
            // Handle the stateChar, then proceed with this one.


            self.debug('call clearStateChar %j', stateChar);
            clearStateChar();
            stateChar = c; // if extglob is disabled, then +(asdf|foo) isn't a thing.
            // just clear the statechar *now*, rather than even diving into
            // the patternList stuff.

            if (options.noext) clearStateChar();
            continue;

          case '(':
            if (inClass) {
              re += '(';
              continue;
            }

            if (!stateChar) {
              re += '\\(';
              continue;
            }

            patternListStack.push({
              type: stateChar,
              start: i - 1,
              reStart: re.length,
              open: plTypes[stateChar].open,
              close: plTypes[stateChar].close
            }); // negation is (?:(?!js)[^/]*)

            re += stateChar === '!' ? '(?:(?!(?:' : '(?:';
            this.debug('plType %j %j', stateChar, re);
            stateChar = false;
            continue;

          case ')':
            if (inClass || !patternListStack.length) {
              re += '\\)';
              continue;
            }

            clearStateChar();
            hasMagic = true;
            var pl = patternListStack.pop(); // negation is (?:(?!js)[^/]*)
            // The others are (?:<pattern>)<type>

            re += pl.close;

            if (pl.type === '!') {
              negativeLists.push(pl);
            }

            pl.reEnd = re.length;
            continue;

          case '|':
            if (inClass || !patternListStack.length || escaping) {
              re += '\\|';
              escaping = false;
              continue;
            }

            clearStateChar();
            re += '|';
            continue;
          // these are mostly the same in regexp and glob

          case '[':
            // swallow any state-tracking char before the [
            clearStateChar();

            if (inClass) {
              re += '\\' + c;
              continue;
            }

            inClass = true;
            classStart = i;
            reClassStart = re.length;
            re += c;
            continue;

          case ']':
            //  a right bracket shall lose its special
            //  meaning and represent itself in
            //  a bracket expression if it occurs
            //  first in the list.  -- POSIX.2 2.8.3.2
            if (i === classStart + 1 || !inClass) {
              re += '\\' + c;
              escaping = false;
              continue;
            } // handle the case where we left a class open.
            // "[z-a]" is valid, equivalent to "\[z-a\]"


            if (inClass) {
              // split where the last [ was, make sure we don't have
              // an invalid re. if so, re-walk the contents of the
              // would-be class to re-translate any characters that
              // were passed through as-is
              // TODO: It would probably be faster to determine this
              // without a try/catch and a new RegExp, but it's tricky
              // to do safely.  For now, this is safe and works.
              var cs = pattern.substring(classStart + 1, i);

              try {
                RegExp('[' + cs + ']');
              } catch (er) {
                // not a valid class!
                var sp = this.parse(cs, SUBPARSE);
                re = re.substr(0, reClassStart) + '\\[' + sp[0] + '\\]';
                hasMagic = hasMagic || sp[1];
                inClass = false;
                continue;
              }
            } // finish up the class.


            hasMagic = true;
            inClass = false;
            re += c;
            continue;

          default:
            // swallow any state char that wasn't consumed
            clearStateChar();

            if (escaping) {
              // no need
              escaping = false;
            } else if (reSpecials[c] && !(c === '^' && inClass)) {
              re += '\\';
            }

            re += c;
        } // switch

      } // for
      // handle the case where we left a class open.
      // "[abc" is valid, equivalent to "\[abc"


      if (inClass) {
        // split where the last [ was, and escape it
        // this is a huge pita.  We now have to re-walk
        // the contents of the would-be class to re-translate
        // any characters that were passed through as-is
        cs = pattern.substr(classStart + 1);
        sp = this.parse(cs, SUBPARSE);
        re = re.substr(0, reClassStart) + '\\[' + sp[0];
        hasMagic = hasMagic || sp[1];
      } // handle the case where we had a +( thing at the *end*
      // of the pattern.
      // each pattern list stack adds 3 chars, and we need to go through
      // and escape any | chars that were passed through as-is for the regexp.
      // Go through and escape them, taking care not to double-escape any
      // | chars that were already escaped.


      for (pl = patternListStack.pop(); pl; pl = patternListStack.pop()) {
        var tail = re.slice(pl.reStart + pl.open.length);
        this.debug('setting tail', re, pl); // maybe some even number of \, then maybe 1 \, followed by a |

        tail = tail.replace(/((?:\\{2}){0,64})(\\?)\|/g, function (_, $1, $2) {
          if (!$2) {
            // the | isn't already escaped, so escape it.
            $2 = '\\';
          } // need to escape all those slashes *again*, without escaping the
          // one that we need for escaping the | character.  As it works out,
          // escaping an even number of slashes can be done by simply repeating
          // it exactly after itself.  That's why this trick works.
          //
          // I am sorry that you have to see this.


          return $1 + $1 + $2 + '|';
        });
        this.debug('tail=%j\n   %s', tail, tail, pl, re);
        var t = pl.type === '*' ? star : pl.type === '?' ? qmark : '\\' + pl.type;
        hasMagic = true;
        re = re.slice(0, pl.reStart) + t + '\\(' + tail;
      } // handle trailing things that only matter at the very end.


      clearStateChar();

      if (escaping) {
        // trailing \\
        re += '\\\\';
      } // only need to apply the nodot start if the re starts with
      // something that could conceivably capture a dot


      var addPatternStart = false;

      switch (re.charAt(0)) {
        case '.':
        case '[':
        case '(':
          addPatternStart = true;
      } // Hack to work around lack of negative lookbehind in JS
      // A pattern like: *.!(x).!(y|z) needs to ensure that a name
      // like 'a.xyz.yz' doesn't match.  So, the first negative
      // lookahead, has to look ALL the way ahead, to the end of
      // the pattern.


      for (var n = negativeLists.length - 1; n > -1; n--) {
        var nl = negativeLists[n];
        var nlBefore = re.slice(0, nl.reStart);
        var nlFirst = re.slice(nl.reStart, nl.reEnd - 8);
        var nlLast = re.slice(nl.reEnd - 8, nl.reEnd);
        var nlAfter = re.slice(nl.reEnd);
        nlLast += nlAfter; // Handle nested stuff like *(*.js|!(*.json)), where open parens
        // mean that we should *not* include the ) in the bit that is considered
        // "after" the negated section.

        var openParensBefore = nlBefore.split('(').length - 1;
        var cleanAfter = nlAfter;

        for (i = 0; i < openParensBefore; i++) {
          cleanAfter = cleanAfter.replace(/\)[+*?]?/, '');
        }

        nlAfter = cleanAfter;
        var dollar = '';

        if (nlAfter === '' && isSub !== SUBPARSE) {
          dollar = '$';
        }

        var newRe = nlBefore + nlFirst + nlAfter + dollar + nlLast;
        re = newRe;
      } // if the re is not "" at this point, then we need to make sure
      // it doesn't match against an empty path part.
      // Otherwise a/* will match a/, which it should not.


      if (re !== '' && hasMagic) {
        re = '(?=.)' + re;
      }

      if (addPatternStart) {
        re = patternStart + re;
      } // parsing just a piece of a larger pattern.


      if (isSub === SUBPARSE) {
        return [re, hasMagic];
      } // skip the regexp for non-magical patterns
      // unescape anything in it, though, so that it'll be
      // an exact match against a file etc.


      if (!hasMagic) {
        return globUnescape(pattern);
      }

      var flags = options.nocase ? 'i' : '';

      try {
        var regExp = new RegExp('^' + re + '$', flags);
      } catch (er) {
        // If it was an invalid regular expression, then it can't match
        // anything.  This trick looks for a character after the end of
        // the string, which is of course impossible, except in multi-line
        // mode, but it's not a /m regex.
        return new RegExp('$.');
      }

      regExp._glob = pattern;
      regExp._src = re;
      return regExp;
    }

    minimatch.makeRe = function (pattern, options) {
      return new Minimatch(pattern, options || {}).makeRe();
    };

    Minimatch.prototype.makeRe = makeRe;

    function makeRe() {
      if (this.regexp || this.regexp === false) return this.regexp; // at this point, this.set is a 2d array of partial
      // pattern strings, or "**".
      //
      // It's better to use .match().  This function shouldn't
      // be used, really, but it's pretty convenient sometimes,
      // when you just want to work with a regex.

      var set = this.set;

      if (!set.length) {
        this.regexp = false;
        return this.regexp;
      }

      var options = this.options;
      var twoStar = options.noglobstar ? star : options.dot ? twoStarDot : twoStarNoDot;
      var flags = options.nocase ? 'i' : '';
      var re = set.map(function (pattern) {
        return pattern.map(function (p) {
          return p === GLOBSTAR ? twoStar : typeof p === 'string' ? regExpEscape(p) : p._src;
        }).join('\\\/');
      }).join('|'); // must match entire pattern
      // ending in a * or ** will make it less strict.

      re = '^(?:' + re + ')$'; // can match anything, as long as it's not this.

      if (this.negate) re = '^(?!' + re + ').*$';

      try {
        this.regexp = new RegExp(re, flags);
      } catch (ex) {
        this.regexp = false;
      }

      return this.regexp;
    }

    minimatch.match = function (list, pattern, options) {
      options = options || {};
      var mm = new Minimatch(pattern, options);
      list = list.filter(function (f) {
        return mm.match(f);
      });

      if (mm.options.nonull && !list.length) {
        list.push(pattern);
      }

      return list;
    };

    Minimatch.prototype.match = match;

    function match(f, partial) {
      this.debug('match', f, this.pattern); // short-circuit in the case of busted things.
      // comments, etc.

      if (this.comment) return false;
      if (this.empty) return f === '';
      if (f === '/' && partial) return true;
      var options = this.options; // windows: need to use /, not \

      if (path.sep !== '/') {
        f = f.split(path.sep).join('/');
      } // treat the test path as a set of pathparts.


      f = f.split(slashSplit);
      this.debug(this.pattern, 'split', f); // just ONE of the pattern sets in this.set needs to match
      // in order for it to be valid.  If negating, then just one
      // match means that we have failed.
      // Either way, return on the first hit.

      var set = this.set;
      this.debug(this.pattern, 'set', set); // Find the basename of the path by looking for the last non-empty segment

      var filename;
      var i;

      for (i = f.length - 1; i >= 0; i--) {
        filename = f[i];
        if (filename) break;
      }

      for (i = 0; i < set.length; i++) {
        var pattern = set[i];
        var file = f;

        if (options.matchBase && pattern.length === 1) {
          file = [filename];
        }

        var hit = this.matchOne(file, pattern, partial);

        if (hit) {
          if (options.flipNegate) return true;
          return !this.negate;
        }
      } // didn't get any hits.  this is success if it's a negative
      // pattern, failure otherwise.


      if (options.flipNegate) return false;
      return this.negate;
    } // set partial to true to test if, for example,
    // "/a/b" matches the start of "/*/b/*/d"
    // Partial means, if you run out of file before you run
    // out of pattern, then that's fine, as long as all
    // the parts match.


    Minimatch.prototype.matchOne = function (file, pattern, partial) {
      var options = this.options;
      this.debug('matchOne', {
        'this': this,
        file: file,
        pattern: pattern
      });
      this.debug('matchOne', file.length, pattern.length);

      for (var fi = 0, pi = 0, fl = file.length, pl = pattern.length; fi < fl && pi < pl; fi++, pi++) {
        this.debug('matchOne loop');
        var p = pattern[pi];
        var f = file[fi];
        this.debug(pattern, p, f); // should be impossible.
        // some invalid regexp stuff in the set.

        if (p === false) return false;

        if (p === GLOBSTAR) {
          this.debug('GLOBSTAR', [pattern, p, f]); // "**"
          // a/**/b/**/c would match the following:
          // a/b/x/y/z/c
          // a/x/y/z/b/c
          // a/b/x/b/x/c
          // a/b/c
          // To do this, take the rest of the pattern after
          // the **, and see if it would match the file remainder.
          // If so, return success.
          // If not, the ** "swallows" a segment, and try again.
          // This is recursively awful.
          //
          // a/**/b/**/c matching a/b/x/y/z/c
          // - a matches a
          // - doublestar
          //   - matchOne(b/x/y/z/c, b/**/c)
          //     - b matches b
          //     - doublestar
          //       - matchOne(x/y/z/c, c) -> no
          //       - matchOne(y/z/c, c) -> no
          //       - matchOne(z/c, c) -> no
          //       - matchOne(c, c) yes, hit

          var fr = fi;
          var pr = pi + 1;

          if (pr === pl) {
            this.debug('** at the end'); // a ** at the end will just swallow the rest.
            // We have found a match.
            // however, it will not swallow /.x, unless
            // options.dot is set.
            // . and .. are *never* matched by **, for explosively
            // exponential reasons.

            for (; fi < fl; fi++) {
              if (file[fi] === '.' || file[fi] === '..' || !options.dot && file[fi].charAt(0) === '.') return false;
            }

            return true;
          } // ok, let's see if we can swallow whatever we can.


          while (fr < fl) {
            var swallowee = file[fr];
            this.debug('\nglobstar while', file, fr, pattern, pr, swallowee); // XXX remove this slice.  Just pass the start index.

            if (this.matchOne(file.slice(fr), pattern.slice(pr), partial)) {
              this.debug('globstar found match!', fr, fl, swallowee); // found a match.

              return true;
            } else {
              // can't swallow "." or ".." ever.
              // can only swallow ".foo" when explicitly asked.
              if (swallowee === '.' || swallowee === '..' || !options.dot && swallowee.charAt(0) === '.') {
                this.debug('dot detected!', file, fr, pattern, pr);
                break;
              } // ** swallows a segment, and continue.


              this.debug('globstar swallow a segment, and continue');
              fr++;
            }
          } // no match was found.
          // However, in partial mode, we can't say this is necessarily over.
          // If there's more *pattern* left, then


          if (partial) {
            // ran out of file
            this.debug('\n>>> no match, partial?', file, fr, pattern, pr);
            if (fr === fl) return true;
          }

          return false;
        } // something other than **
        // non-magic patterns just have to match exactly
        // patterns with magic have been turned into regexps.


        var hit;

        if (typeof p === 'string') {
          if (options.nocase) {
            hit = f.toLowerCase() === p.toLowerCase();
          } else {
            hit = f === p;
          }

          this.debug('string match', p, f, hit);
        } else {
          hit = f.match(p);
          this.debug('pattern match', p, f, hit);
        }

        if (!hit) return false;
      } // Note: ending in / means that we'll get a final ""
      // at the end of the pattern.  This can only match a
      // corresponding "" at the end of the file.
      // If the file ends in /, then it can only match a
      // a pattern that ends in /, unless the pattern just
      // doesn't have any more for it. But, a/b/ should *not*
      // match "a/b/*", even though "" matches against the
      // [^/]*? pattern, except in partial mode, where it might
      // simply not be reached yet.
      // However, a/b/ should still satisfy a/*
      // now either we fell off the end of the pattern, or we're done.


      if (fi === fl && pi === pl) {
        // ran out of pattern and filename at the same time.
        // an exact hit!
        return true;
      } else if (fi === fl) {
        // ran out of file, but still had pattern left.
        // this is ok if we're doing the match as part of
        // a glob fs traversal.
        return partial;
      } else if (pi === pl) {
        // ran out of pattern, still have file left.
        // this is only acceptable if we're on the very last
        // empty segment of a file with a trailing slash.
        // a/* should match a/b/
        var emptyFileEnd = fi === fl - 1 && file[fi] === '';
        return emptyFileEnd;
      } // should be unreachable.


      throw new Error('wtf?');
    }; // replace stuff like \* with *


    function globUnescape(s) {
      return s.replace(/\\(.)/g, '$1');
    }

    function regExpEscape(s) {
      return s.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
    }

    'use strict';

    var matcherCollection =
    /** @class */
    function () {
      function MatcherCollection(matchers) {
        this.matchers = matchers.map(function (matcher) {
          return typeof matcher === 'string' ? new minimatch_1.Minimatch(matcher) : matcher;
        });
      }

      MatcherCollection.prototype.match = function (value) {
        for (var i = 0; i < this.matchers.length; i++) {
          if (this.matchers[i].match(value)) {
            return true;
          }
        }

        return false;
      };

      MatcherCollection.prototype.mayContain = function (value) {
        var parts = value.split(/\/|\\/g).filter(Boolean);

        for (var i = 0; i < this.matchers.length; i++) {
          var matcher = this.matchers[i];

          for (var j = 0; j < matcher.set.length; j++) {
            if (matcher.matchOne(parts, matcher.set[j], true)) {
              return true;
            }
          }
        }

        return false;
      };

      ;
      return MatcherCollection;
    }();

    "use strict";

    var ensurePosixPath = function ensurePosix(filepath) {
      if (path$1.sep !== '/') {
        return filepath.split(path$1.sep).join('/');
      }

      return filepath;
    };

    'use strict';

    function walkSync(baseDir, inputOptions) {
      const options = handleOptions(inputOptions);
      let mapFunct;

      if (options.includeBasePath) {
        mapFunct = function (entry) {
          return entry.basePath.split(path$1.sep).join('/') + '/' + entry.relativePath;
        };
      } else {
        mapFunct = function (entry) {
          return entry.relativePath;
        };
      }

      return _walkSync(baseDir, options, null, []).map(mapFunct);
    }

    function getStat(path) {
      try {
        return fs.statSync(path);
      } catch (error) {
        if (error !== null && typeof error === 'object' && (error.code === 'ENOENT' || error.code === 'ENOTDIR')) {
          return;
        }

        throw error;
      }
    }

    (function (walkSync) {
      function entries(baseDir, inputOptions) {
        const options = handleOptions(inputOptions);
        return _walkSync(ensurePosixPath(baseDir), options, null, []);
      }

      walkSync.entries = entries;
      ;

      class Entry {
        constructor(relativePath, basePath, mode, size, mtime) {
          this.relativePath = relativePath;
          this.basePath = basePath;
          this.mode = mode;
          this.size = size;
          this.mtime = mtime;
        }

        get fullPath() {
          return `${this.basePath}/${this.relativePath}`;
        }

        isDirectory() {
          return (this.mode & 61440) === 16384;
        }

      }

      walkSync.Entry = Entry;
    })(walkSync || (walkSync = {}));

    function isDefined(val) {
      return typeof val !== 'undefined';
    }

    function handleOptions(_options) {
      let options = {};

      if (Array.isArray(_options)) {
        options.globs = _options;
      } else if (_options) {
        options = _options;
      }

      return options;
    }

    function handleRelativePath(_relativePath) {
      if (_relativePath == null) {
        return '';
      } else if (_relativePath.slice(-1) !== '/') {
        return _relativePath + '/';
      } else {
        return _relativePath;
      }
    }

    function lexicographically(a, b) {
      const aPath = a.relativePath;
      const bPath = b.relativePath;

      if (aPath === bPath) {
        return 0;
      } else if (aPath < bPath) {
        return -1;
      } else {
        return 1;
      }
    }

    function _walkSync(baseDir, options, _relativePath, visited) {
      // Inside this function, prefer string concatenation to the slower path.join
      // https://github.com/joyent/node/pull/6929
      const relativePath = handleRelativePath(_relativePath);
      const realPath = fs.realpathSync(baseDir + '/' + relativePath);

      if (visited.indexOf(realPath) >= 0) {
        return [];
      } else {
        visited.push(realPath);
      }

      try {
        const globs = options.globs;
        const ignorePatterns = options.ignore;
        let globMatcher;
        let ignoreMatcher;
        let results = [];

        if (ignorePatterns) {
          ignoreMatcher = new matcherCollection(ignorePatterns);
        }

        if (globs) {
          globMatcher = new matcherCollection(globs);
        }

        if (globMatcher && !globMatcher.mayContain(relativePath)) {
          return results;
        }

        const names = fs.readdirSync(baseDir + '/' + relativePath);
        const entries = names.map(name => {
          let entryRelativePath = relativePath + name;

          if (ignoreMatcher && ignoreMatcher.match(entryRelativePath)) {
            return;
          }

          let fullPath = baseDir + '/' + entryRelativePath;
          let stats = getStat(fullPath);

          if (stats && stats.isDirectory()) {
            return new walkSync.Entry(entryRelativePath + '/', baseDir, stats.mode, stats.size, stats.mtime.getTime());
          } else {
            return new walkSync.Entry(entryRelativePath, baseDir, stats && stats.mode || 0, stats && stats.size || 0, stats && stats.mtime.getTime() || 0);
          }
        }).filter(isDefined);
        const sortedEntries = entries.sort(lexicographically);

        for (let i = 0; i < sortedEntries.length; ++i) {
          let entry = sortedEntries[i];

          if (entry.isDirectory()) {
            if (options.directories !== false && (!globMatcher || globMatcher.match(entry.relativePath))) {
              results.push(entry);
            }

            results = results.concat(_walkSync(baseDir, options, entry.relativePath, visited));
          } else {
            if (!globMatcher || globMatcher.match(entry.relativePath)) {
              results.push(entry);
            }
          }
        }

        return results;
      } finally {
        visited.pop();
      }
    }

    var walkSync_1 = walkSync;

    var commonjsGlobal = typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : typeof global !== 'undefined' ? global : typeof self !== 'undefined' ? self : {};

    function commonjsRequire () {
    	throw new Error('Dynamic requires are not currently supported by rollup-plugin-commonjs');
    }

    function unwrapExports (x) {
    	return x && x.__esModule && Object.prototype.hasOwnProperty.call(x, 'default') ? x['default'] : x;
    }

    function createCommonjsModule(fn, module) {
    	return module = { exports: {} }, fn(module, module.exports), module.exports;
    }

    function getCjsExportFromNamespace (n) {
    	return n && n['default'] || n;
    }

    //
    // Permission is hereby granted, free of charge, to any person obtaining a
    // copy of this software and associated documentation files (the
    // "Software"), to deal in the Software without restriction, including
    // without limitation the rights to use, copy, modify, merge, publish,
    // distribute, sublicense, and/or sell copies of the Software, and to permit
    // persons to whom the Software is furnished to do so, subject to the
    // following conditions:
    //
    // The above copyright notice and this permission notice shall be included
    // in all copies or substantial portions of the Software.
    //
    // THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
    // OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
    // MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
    // NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
    // DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
    // OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
    // USE OR OTHER DEALINGS IN THE SOFTWARE.

    var isWindows = process.platform === 'win32'; // JavaScript implementation of realpath, ported from node pre-v6

    var DEBUG = process.env.NODE_DEBUG && /fs/.test(process.env.NODE_DEBUG);

    function rethrow() {
      // Only enable in debug mode. A backtrace uses ~1000 bytes of heap space and
      // is fairly slow to generate.
      var callback;

      if (DEBUG) {
        var backtrace = new Error();
        callback = debugCallback;
      } else callback = missingCallback;

      return callback;

      function debugCallback(err) {
        if (err) {
          backtrace.message = err.message;
          err = backtrace;
          missingCallback(err);
        }
      }

      function missingCallback(err) {
        if (err) {
          if (process.throwDeprecation) throw err; // Forgot a callback but don't know where? Use NODE_DEBUG=fs
          else if (!process.noDeprecation) {
              var msg = 'fs: missing callback ' + (err.stack || err.message);
              if (process.traceDeprecation) console.trace(msg);else console.error(msg);
            }
        }
      }
    }

    function maybeCallback(cb) {
      return typeof cb === 'function' ? cb : rethrow();
    }

    var normalize = path$1.normalize; // Regexp that finds the next partion of a (partial) path
    // result is [base_with_slash, base], e.g. ['somedir/', 'somedir']

    if (isWindows) {
      var nextPartRe = /(.*?)(?:[\/\\]+|$)/g;
    } else {
      var nextPartRe = /(.*?)(?:[\/]+|$)/g;
    } // Regex to find the device root, including trailing slash. E.g. 'c:\\'.


    if (isWindows) {
      var splitRootRe = /^(?:[a-zA-Z]:|[\\\/]{2}[^\\\/]+[\\\/][^\\\/]+)?[\\\/]*/;
    } else {
      var splitRootRe = /^[\/]*/;
    }

    var realpathSync = function realpathSync(p, cache) {
      // make p is absolute
      p = path$1.resolve(p);

      if (cache && Object.prototype.hasOwnProperty.call(cache, p)) {
        return cache[p];
      }

      var original = p,
          seenLinks = {},
          knownHard = {}; // current character position in p

      var pos; // the partial path so far, including a trailing slash if any

      var current; // the partial path without a trailing slash (except when pointing at a root)

      var base; // the partial path scanned in the previous round, with slash

      var previous;
      start();

      function start() {
        // Skip over roots
        var m = splitRootRe.exec(p);
        pos = m[0].length;
        current = m[0];
        base = m[0];
        previous = ''; // On windows, check that the root exists. On unix there is no need.

        if (isWindows && !knownHard[base]) {
          fs.lstatSync(base);
          knownHard[base] = true;
        }
      } // walk down the path, swapping out linked pathparts for their real
      // values
      // NB: p.length changes.


      while (pos < p.length) {
        // find the next part
        nextPartRe.lastIndex = pos;
        var result = nextPartRe.exec(p);
        previous = current;
        current += result[0];
        base = previous + result[1];
        pos = nextPartRe.lastIndex; // continue if not a symlink

        if (knownHard[base] || cache && cache[base] === base) {
          continue;
        }

        var resolvedLink;

        if (cache && Object.prototype.hasOwnProperty.call(cache, base)) {
          // some known symbolic link.  no need to stat again.
          resolvedLink = cache[base];
        } else {
          var stat = fs.lstatSync(base);

          if (!stat.isSymbolicLink()) {
            knownHard[base] = true;
            if (cache) cache[base] = base;
            continue;
          } // read the link if it wasn't read before
          // dev/ino always return 0 on windows, so skip the check.


          var linkTarget = null;

          if (!isWindows) {
            var id = stat.dev.toString(32) + ':' + stat.ino.toString(32);

            if (seenLinks.hasOwnProperty(id)) {
              linkTarget = seenLinks[id];
            }
          }

          if (linkTarget === null) {
            fs.statSync(base);
            linkTarget = fs.readlinkSync(base);
          }

          resolvedLink = path$1.resolve(previous, linkTarget); // track this, if given a cache.

          if (cache) cache[base] = resolvedLink;
          if (!isWindows) seenLinks[id] = linkTarget;
        } // resolve the link, then start over


        p = path$1.resolve(resolvedLink, p.slice(pos));
        start();
      }

      if (cache) cache[original] = p;
      return p;
    };

    var realpath = function realpath(p, cache, cb) {
      if (typeof cb !== 'function') {
        cb = maybeCallback(cache);
        cache = null;
      } // make p is absolute


      p = path$1.resolve(p);

      if (cache && Object.prototype.hasOwnProperty.call(cache, p)) {
        return process.nextTick(cb.bind(null, null, cache[p]));
      }

      var original = p,
          seenLinks = {},
          knownHard = {}; // current character position in p

      var pos; // the partial path so far, including a trailing slash if any

      var current; // the partial path without a trailing slash (except when pointing at a root)

      var base; // the partial path scanned in the previous round, with slash

      var previous;
      start();

      function start() {
        // Skip over roots
        var m = splitRootRe.exec(p);
        pos = m[0].length;
        current = m[0];
        base = m[0];
        previous = ''; // On windows, check that the root exists. On unix there is no need.

        if (isWindows && !knownHard[base]) {
          fs.lstat(base, function (err) {
            if (err) return cb(err);
            knownHard[base] = true;
            LOOP();
          });
        } else {
          process.nextTick(LOOP);
        }
      } // walk down the path, swapping out linked pathparts for their real
      // values


      function LOOP() {
        // stop if scanned past end of path
        if (pos >= p.length) {
          if (cache) cache[original] = p;
          return cb(null, p);
        } // find the next part


        nextPartRe.lastIndex = pos;
        var result = nextPartRe.exec(p);
        previous = current;
        current += result[0];
        base = previous + result[1];
        pos = nextPartRe.lastIndex; // continue if not a symlink

        if (knownHard[base] || cache && cache[base] === base) {
          return process.nextTick(LOOP);
        }

        if (cache && Object.prototype.hasOwnProperty.call(cache, base)) {
          // known symbolic link.  no need to stat again.
          return gotResolvedLink(cache[base]);
        }

        return fs.lstat(base, gotStat);
      }

      function gotStat(err, stat) {
        if (err) return cb(err); // if not a symlink, skip to the next path part

        if (!stat.isSymbolicLink()) {
          knownHard[base] = true;
          if (cache) cache[base] = base;
          return process.nextTick(LOOP);
        } // stat & read the link if not read before
        // call gotTarget as soon as the link target is known
        // dev/ino always return 0 on windows, so skip the check.


        if (!isWindows) {
          var id = stat.dev.toString(32) + ':' + stat.ino.toString(32);

          if (seenLinks.hasOwnProperty(id)) {
            return gotTarget(null, seenLinks[id], base);
          }
        }

        fs.stat(base, function (err) {
          if (err) return cb(err);
          fs.readlink(base, function (err, target) {
            if (!isWindows) seenLinks[id] = target;
            gotTarget(err, target);
          });
        });
      }

      function gotTarget(err, target, base) {
        if (err) return cb(err);
        var resolvedLink = path$1.resolve(previous, target);
        if (cache) cache[base] = resolvedLink;
        gotResolvedLink(resolvedLink);
      }

      function gotResolvedLink(resolvedLink) {
        // resolve the link, then start over
        p = path$1.resolve(resolvedLink, p.slice(pos));
        start();
      }
    };

    var old = {
      realpathSync: realpathSync,
      realpath: realpath
    };

    var fs_realpath = realpath$1;
    realpath$1.realpath = realpath$1;
    realpath$1.sync = realpathSync$1;
    realpath$1.realpathSync = realpathSync$1;
    realpath$1.monkeypatch = monkeypatch;
    realpath$1.unmonkeypatch = unmonkeypatch;
    var origRealpath = fs.realpath;
    var origRealpathSync = fs.realpathSync;
    var version = process.version;
    var ok = /^v[0-5]\./.test(version);

    function newError(er) {
      return er && er.syscall === 'realpath' && (er.code === 'ELOOP' || er.code === 'ENOMEM' || er.code === 'ENAMETOOLONG');
    }

    function realpath$1(p, cache, cb) {
      if (ok) {
        return origRealpath(p, cache, cb);
      }

      if (typeof cache === 'function') {
        cb = cache;
        cache = null;
      }

      origRealpath(p, cache, function (er, result) {
        if (newError(er)) {
          old.realpath(p, cache, cb);
        } else {
          cb(er, result);
        }
      });
    }

    function realpathSync$1(p, cache) {
      if (ok) {
        return origRealpathSync(p, cache);
      }

      try {
        return origRealpathSync(p, cache);
      } catch (er) {
        if (newError(er)) {
          return old.realpathSync(p, cache);
        } else {
          throw er;
        }
      }
    }

    function monkeypatch() {
      fs.realpath = realpath$1;
      fs.realpathSync = realpathSync$1;
    }

    function unmonkeypatch() {
      fs.realpath = origRealpath;
      fs.realpathSync = origRealpathSync;
    }

    var inherits_browser = createCommonjsModule(function (module) {
      if (typeof Object.create === 'function') {
        // implementation from standard node.js 'util' module
        module.exports = function inherits(ctor, superCtor) {
          ctor.super_ = superCtor;
          ctor.prototype = Object.create(superCtor.prototype, {
            constructor: {
              value: ctor,
              enumerable: false,
              writable: true,
              configurable: true
            }
          });
        };
      } else {
        // old school shim for old browsers
        module.exports = function inherits(ctor, superCtor) {
          ctor.super_ = superCtor;

          var TempCtor = function () {};

          TempCtor.prototype = superCtor.prototype;
          ctor.prototype = new TempCtor();
          ctor.prototype.constructor = ctor;
        };
      }
    });

    var inherits = createCommonjsModule(function (module) {
      try {
        var util$1 = util;
        if (typeof util$1.inherits !== 'function') throw '';
        module.exports = util$1.inherits;
      } catch (e) {
        module.exports = inherits_browser;
      }
    });

    'use strict';

    function posix(path) {
      return path.charAt(0) === '/';
    }

    function win32(path) {
      // https://github.com/nodejs/node/blob/b3fcc245fb25539909ef1d5eaa01dbf92e168633/lib/path.js#L56
      var splitDeviceRe = /^([a-zA-Z]:|[\\\/]{2}[^\\\/]+[\\\/]+[^\\\/]+)?([\\\/])?([\s\S]*?)$/;
      var result = splitDeviceRe.exec(path);
      var device = result[1] || '';
      var isUnc = Boolean(device && device.charAt(1) !== ':'); // UNC paths are always absolute

      return Boolean(result[2] || isUnc);
    }

    var pathIsAbsolute = process.platform === 'win32' ? win32 : posix;
    var posix_1 = posix;
    var win32_1 = win32;
    pathIsAbsolute.posix = posix_1;
    pathIsAbsolute.win32 = win32_1;

    var alphasort_1 = alphasort;
    var alphasorti_1 = alphasorti;
    var setopts_1 = setopts;
    var ownProp_1 = ownProp;
    var makeAbs_1 = makeAbs;
    var finish_1 = finish;
    var mark_1 = mark;
    var isIgnored_1 = isIgnored;
    var childrenIgnored_1 = childrenIgnored;

    function ownProp(obj, field) {
      return Object.prototype.hasOwnProperty.call(obj, field);
    }

    var Minimatch$1 = minimatch_1.Minimatch;

    function alphasorti(a, b) {
      return a.toLowerCase().localeCompare(b.toLowerCase());
    }

    function alphasort(a, b) {
      return a.localeCompare(b);
    }

    function setupIgnores(self, options) {
      self.ignore = options.ignore || [];
      if (!Array.isArray(self.ignore)) self.ignore = [self.ignore];

      if (self.ignore.length) {
        self.ignore = self.ignore.map(ignoreMap);
      }
    } // ignore patterns are always in dot:true mode.


    function ignoreMap(pattern) {
      var gmatcher = null;

      if (pattern.slice(-3) === '/**') {
        var gpattern = pattern.replace(/(\/\*\*)+$/, '');
        gmatcher = new Minimatch$1(gpattern, {
          dot: true
        });
      }

      return {
        matcher: new Minimatch$1(pattern, {
          dot: true
        }),
        gmatcher: gmatcher
      };
    }

    function setopts(self, pattern, options) {
      if (!options) options = {}; // base-matching: just use globstar for that.

      if (options.matchBase && -1 === pattern.indexOf("/")) {
        if (options.noglobstar) {
          throw new Error("base matching requires globstar");
        }

        pattern = "**/" + pattern;
      }

      self.silent = !!options.silent;
      self.pattern = pattern;
      self.strict = options.strict !== false;
      self.realpath = !!options.realpath;
      self.realpathCache = options.realpathCache || Object.create(null);
      self.follow = !!options.follow;
      self.dot = !!options.dot;
      self.mark = !!options.mark;
      self.nodir = !!options.nodir;
      if (self.nodir) self.mark = true;
      self.sync = !!options.sync;
      self.nounique = !!options.nounique;
      self.nonull = !!options.nonull;
      self.nosort = !!options.nosort;
      self.nocase = !!options.nocase;
      self.stat = !!options.stat;
      self.noprocess = !!options.noprocess;
      self.absolute = !!options.absolute;
      self.maxLength = options.maxLength || Infinity;
      self.cache = options.cache || Object.create(null);
      self.statCache = options.statCache || Object.create(null);
      self.symlinks = options.symlinks || Object.create(null);
      setupIgnores(self, options);
      self.changedCwd = false;
      var cwd = process.cwd();
      if (!ownProp(options, "cwd")) self.cwd = cwd;else {
        self.cwd = path$1.resolve(options.cwd);
        self.changedCwd = self.cwd !== cwd;
      }
      self.root = options.root || path$1.resolve(self.cwd, "/");
      self.root = path$1.resolve(self.root);
      if (process.platform === "win32") self.root = self.root.replace(/\\/g, "/"); // TODO: is an absolute `cwd` supposed to be resolved against `root`?
      // e.g. { cwd: '/test', root: __dirname } === path.join(__dirname, '/test')

      self.cwdAbs = pathIsAbsolute(self.cwd) ? self.cwd : makeAbs(self, self.cwd);
      if (process.platform === "win32") self.cwdAbs = self.cwdAbs.replace(/\\/g, "/");
      self.nomount = !!options.nomount; // disable comments and negation in Minimatch.
      // Note that they are not supported in Glob itself anyway.

      options.nonegate = true;
      options.nocomment = true;
      self.minimatch = new Minimatch$1(pattern, options);
      self.options = self.minimatch.options;
    }

    function finish(self) {
      var nou = self.nounique;
      var all = nou ? [] : Object.create(null);

      for (var i = 0, l = self.matches.length; i < l; i++) {
        var matches = self.matches[i];

        if (!matches || Object.keys(matches).length === 0) {
          if (self.nonull) {
            // do like the shell, and spit out the literal glob
            var literal = self.minimatch.globSet[i];
            if (nou) all.push(literal);else all[literal] = true;
          }
        } else {
          // had matches
          var m = Object.keys(matches);
          if (nou) all.push.apply(all, m);else m.forEach(function (m) {
            all[m] = true;
          });
        }
      }

      if (!nou) all = Object.keys(all);
      if (!self.nosort) all = all.sort(self.nocase ? alphasorti : alphasort); // at *some* point we statted all of these

      if (self.mark) {
        for (var i = 0; i < all.length; i++) {
          all[i] = self._mark(all[i]);
        }

        if (self.nodir) {
          all = all.filter(function (e) {
            var notDir = !/\/$/.test(e);
            var c = self.cache[e] || self.cache[makeAbs(self, e)];
            if (notDir && c) notDir = c !== 'DIR' && !Array.isArray(c);
            return notDir;
          });
        }
      }

      if (self.ignore.length) all = all.filter(function (m) {
        return !isIgnored(self, m);
      });
      self.found = all;
    }

    function mark(self, p) {
      var abs = makeAbs(self, p);
      var c = self.cache[abs];
      var m = p;

      if (c) {
        var isDir = c === 'DIR' || Array.isArray(c);
        var slash = p.slice(-1) === '/';
        if (isDir && !slash) m += '/';else if (!isDir && slash) m = m.slice(0, -1);

        if (m !== p) {
          var mabs = makeAbs(self, m);
          self.statCache[mabs] = self.statCache[abs];
          self.cache[mabs] = self.cache[abs];
        }
      }

      return m;
    } // lotta situps...


    function makeAbs(self, f) {
      var abs = f;

      if (f.charAt(0) === '/') {
        abs = path$1.join(self.root, f);
      } else if (pathIsAbsolute(f) || f === '') {
        abs = f;
      } else if (self.changedCwd) {
        abs = path$1.resolve(self.cwd, f);
      } else {
        abs = path$1.resolve(f);
      }

      if (process.platform === 'win32') abs = abs.replace(/\\/g, '/');
      return abs;
    } // Return true, if pattern ends with globstar '**', for the accompanying parent directory.
    // Ex:- If node_modules/** is the pattern, add 'node_modules' to ignore list along with it's contents


    function isIgnored(self, path) {
      if (!self.ignore.length) return false;
      return self.ignore.some(function (item) {
        return item.matcher.match(path) || !!(item.gmatcher && item.gmatcher.match(path));
      });
    }

    function childrenIgnored(self, path) {
      if (!self.ignore.length) return false;
      return self.ignore.some(function (item) {
        return !!(item.gmatcher && item.gmatcher.match(path));
      });
    }

    var common = {
      alphasort: alphasort_1,
      alphasorti: alphasorti_1,
      setopts: setopts_1,
      ownProp: ownProp_1,
      makeAbs: makeAbs_1,
      finish: finish_1,
      mark: mark_1,
      isIgnored: isIgnored_1,
      childrenIgnored: childrenIgnored_1
    };

    var sync = globSync;
    globSync.GlobSync = GlobSync;
    var Minimatch$2 = minimatch_1.Minimatch;
    var Glob = glob_1.Glob;
    var alphasort$1 = common.alphasort;
    var alphasorti$1 = common.alphasorti;
    var setopts$1 = common.setopts;
    var ownProp$1 = common.ownProp;
    var childrenIgnored$1 = common.childrenIgnored;
    var isIgnored$1 = common.isIgnored;

    function globSync(pattern, options) {
      if (typeof options === 'function' || arguments.length === 3) throw new TypeError('callback provided to sync glob\n' + 'See: https://github.com/isaacs/node-glob/issues/167');
      return new GlobSync(pattern, options).found;
    }

    function GlobSync(pattern, options) {
      if (!pattern) throw new Error('must provide pattern');
      if (typeof options === 'function' || arguments.length === 3) throw new TypeError('callback provided to sync glob\n' + 'See: https://github.com/isaacs/node-glob/issues/167');
      if (!(this instanceof GlobSync)) return new GlobSync(pattern, options);
      setopts$1(this, pattern, options);
      if (this.noprocess) return this;
      var n = this.minimatch.set.length;
      this.matches = new Array(n);

      for (var i = 0; i < n; i++) {
        this._process(this.minimatch.set[i], i, false);
      }

      this._finish();
    }

    GlobSync.prototype._finish = function () {
      assert(this instanceof GlobSync);

      if (this.realpath) {
        var self = this;
        this.matches.forEach(function (matchset, index) {
          var set = self.matches[index] = Object.create(null);

          for (var p in matchset) {
            try {
              p = self._makeAbs(p);
              var real = fs_realpath.realpathSync(p, self.realpathCache);
              set[real] = true;
            } catch (er) {
              if (er.syscall === 'stat') set[self._makeAbs(p)] = true;else throw er;
            }
          }
        });
      }

      common.finish(this);
    };

    GlobSync.prototype._process = function (pattern, index, inGlobStar) {
      assert(this instanceof GlobSync); // Get the first [n] parts of pattern that are all strings.

      var n = 0;

      while (typeof pattern[n] === 'string') {
        n++;
      } // now n is the index of the first one that is *not* a string.
      // See if there's anything else


      var prefix;

      switch (n) {
        // if not, then this is rather simple
        case pattern.length:
          this._processSimple(pattern.join('/'), index);

          return;

        case 0:
          // pattern *starts* with some non-trivial item.
          // going to readdir(cwd), but not include the prefix in matches.
          prefix = null;
          break;

        default:
          // pattern has some string bits in the front.
          // whatever it starts with, whether that's 'absolute' like /foo/bar,
          // or 'relative' like '../baz'
          prefix = pattern.slice(0, n).join('/');
          break;
      }

      var remain = pattern.slice(n); // get the list of entries.

      var read;
      if (prefix === null) read = '.';else if (pathIsAbsolute(prefix) || pathIsAbsolute(pattern.join('/'))) {
        if (!prefix || !pathIsAbsolute(prefix)) prefix = '/' + prefix;
        read = prefix;
      } else read = prefix;

      var abs = this._makeAbs(read); //if ignored, skip processing


      if (childrenIgnored$1(this, read)) return;
      var isGlobStar = remain[0] === minimatch_1.GLOBSTAR;
      if (isGlobStar) this._processGlobStar(prefix, read, abs, remain, index, inGlobStar);else this._processReaddir(prefix, read, abs, remain, index, inGlobStar);
    };

    GlobSync.prototype._processReaddir = function (prefix, read, abs, remain, index, inGlobStar) {
      var entries = this._readdir(abs, inGlobStar); // if the abs isn't a dir, then nothing can match!


      if (!entries) return; // It will only match dot entries if it starts with a dot, or if
      // dot is set.  Stuff like @(.foo|.bar) isn't allowed.

      var pn = remain[0];
      var negate = !!this.minimatch.negate;
      var rawGlob = pn._glob;
      var dotOk = this.dot || rawGlob.charAt(0) === '.';
      var matchedEntries = [];

      for (var i = 0; i < entries.length; i++) {
        var e = entries[i];

        if (e.charAt(0) !== '.' || dotOk) {
          var m;

          if (negate && !prefix) {
            m = !e.match(pn);
          } else {
            m = e.match(pn);
          }

          if (m) matchedEntries.push(e);
        }
      }

      var len = matchedEntries.length; // If there are no matched entries, then nothing matches.

      if (len === 0) return; // if this is the last remaining pattern bit, then no need for
      // an additional stat *unless* the user has specified mark or
      // stat explicitly.  We know they exist, since readdir returned
      // them.

      if (remain.length === 1 && !this.mark && !this.stat) {
        if (!this.matches[index]) this.matches[index] = Object.create(null);

        for (var i = 0; i < len; i++) {
          var e = matchedEntries[i];

          if (prefix) {
            if (prefix.slice(-1) !== '/') e = prefix + '/' + e;else e = prefix + e;
          }

          if (e.charAt(0) === '/' && !this.nomount) {
            e = path$1.join(this.root, e);
          }

          this._emitMatch(index, e);
        } // This was the last one, and no stats were needed


        return;
      } // now test all matched entries as stand-ins for that part
      // of the pattern.


      remain.shift();

      for (var i = 0; i < len; i++) {
        var e = matchedEntries[i];
        var newPattern;
        if (prefix) newPattern = [prefix, e];else newPattern = [e];

        this._process(newPattern.concat(remain), index, inGlobStar);
      }
    };

    GlobSync.prototype._emitMatch = function (index, e) {
      if (isIgnored$1(this, e)) return;

      var abs = this._makeAbs(e);

      if (this.mark) e = this._mark(e);

      if (this.absolute) {
        e = abs;
      }

      if (this.matches[index][e]) return;

      if (this.nodir) {
        var c = this.cache[abs];
        if (c === 'DIR' || Array.isArray(c)) return;
      }

      this.matches[index][e] = true;
      if (this.stat) this._stat(e);
    };

    GlobSync.prototype._readdirInGlobStar = function (abs) {
      // follow all symlinked directories forever
      // just proceed as if this is a non-globstar situation
      if (this.follow) return this._readdir(abs, false);
      var entries;
      var lstat;
      var stat;

      try {
        lstat = fs.lstatSync(abs);
      } catch (er) {
        if (er.code === 'ENOENT') {
          // lstat failed, doesn't exist
          return null;
        }
      }

      var isSym = lstat && lstat.isSymbolicLink();
      this.symlinks[abs] = isSym; // If it's not a symlink or a dir, then it's definitely a regular file.
      // don't bother doing a readdir in that case.

      if (!isSym && lstat && !lstat.isDirectory()) this.cache[abs] = 'FILE';else entries = this._readdir(abs, false);
      return entries;
    };

    GlobSync.prototype._readdir = function (abs, inGlobStar) {
      var entries;
      if (inGlobStar && !ownProp$1(this.symlinks, abs)) return this._readdirInGlobStar(abs);

      if (ownProp$1(this.cache, abs)) {
        var c = this.cache[abs];
        if (!c || c === 'FILE') return null;
        if (Array.isArray(c)) return c;
      }

      try {
        return this._readdirEntries(abs, fs.readdirSync(abs));
      } catch (er) {
        this._readdirError(abs, er);

        return null;
      }
    };

    GlobSync.prototype._readdirEntries = function (abs, entries) {
      // if we haven't asked to stat everything, then just
      // assume that everything in there exists, so we can avoid
      // having to stat it a second time.
      if (!this.mark && !this.stat) {
        for (var i = 0; i < entries.length; i++) {
          var e = entries[i];
          if (abs === '/') e = abs + e;else e = abs + '/' + e;
          this.cache[e] = true;
        }
      }

      this.cache[abs] = entries; // mark and cache dir-ness

      return entries;
    };

    GlobSync.prototype._readdirError = function (f, er) {
      // handle errors, and cache the information
      switch (er.code) {
        case 'ENOTSUP': // https://github.com/isaacs/node-glob/issues/205

        case 'ENOTDIR':
          // totally normal. means it *does* exist.
          var abs = this._makeAbs(f);

          this.cache[abs] = 'FILE';

          if (abs === this.cwdAbs) {
            var error = new Error(er.code + ' invalid cwd ' + this.cwd);
            error.path = this.cwd;
            error.code = er.code;
            throw error;
          }

          break;

        case 'ENOENT': // not terribly unusual

        case 'ELOOP':
        case 'ENAMETOOLONG':
        case 'UNKNOWN':
          this.cache[this._makeAbs(f)] = false;
          break;

        default:
          // some unusual error.  Treat as failure.
          this.cache[this._makeAbs(f)] = false;
          if (this.strict) throw er;
          if (!this.silent) console.error('glob error', er);
          break;
      }
    };

    GlobSync.prototype._processGlobStar = function (prefix, read, abs, remain, index, inGlobStar) {
      var entries = this._readdir(abs, inGlobStar); // no entries means not a dir, so it can never have matches
      // foo.txt/** doesn't match foo.txt


      if (!entries) return; // test without the globstar, and with every child both below
      // and replacing the globstar.

      var remainWithoutGlobStar = remain.slice(1);
      var gspref = prefix ? [prefix] : [];
      var noGlobStar = gspref.concat(remainWithoutGlobStar); // the noGlobStar pattern exits the inGlobStar state

      this._process(noGlobStar, index, false);

      var len = entries.length;
      var isSym = this.symlinks[abs]; // If it's a symlink, and we're in a globstar, then stop

      if (isSym && inGlobStar) return;

      for (var i = 0; i < len; i++) {
        var e = entries[i];
        if (e.charAt(0) === '.' && !this.dot) continue; // these two cases enter the inGlobStar state

        var instead = gspref.concat(entries[i], remainWithoutGlobStar);

        this._process(instead, index, true);

        var below = gspref.concat(entries[i], remain);

        this._process(below, index, true);
      }
    };

    GlobSync.prototype._processSimple = function (prefix, index) {
      // XXX review this.  Shouldn't it be doing the mounting etc
      // before doing stat?  kinda weird?
      var exists = this._stat(prefix);

      if (!this.matches[index]) this.matches[index] = Object.create(null); // If it doesn't exist, then just mark the lack of results

      if (!exists) return;

      if (prefix && pathIsAbsolute(prefix) && !this.nomount) {
        var trail = /[\/\\]$/.test(prefix);

        if (prefix.charAt(0) === '/') {
          prefix = path$1.join(this.root, prefix);
        } else {
          prefix = path$1.resolve(this.root, prefix);
          if (trail) prefix += '/';
        }
      }

      if (process.platform === 'win32') prefix = prefix.replace(/\\/g, '/'); // Mark this as a match

      this._emitMatch(index, prefix);
    }; // Returns either 'DIR', 'FILE', or false


    GlobSync.prototype._stat = function (f) {
      var abs = this._makeAbs(f);

      var needDir = f.slice(-1) === '/';
      if (f.length > this.maxLength) return false;

      if (!this.stat && ownProp$1(this.cache, abs)) {
        var c = this.cache[abs];
        if (Array.isArray(c)) c = 'DIR'; // It exists, but maybe not how we need it

        if (!needDir || c === 'DIR') return c;
        if (needDir && c === 'FILE') return false; // otherwise we have to stat, because maybe c=true
        // if we know it exists, but not what it is.
      }

      var exists;
      var stat = this.statCache[abs];

      if (!stat) {
        var lstat;

        try {
          lstat = fs.lstatSync(abs);
        } catch (er) {
          if (er && (er.code === 'ENOENT' || er.code === 'ENOTDIR')) {
            this.statCache[abs] = false;
            return false;
          }
        }

        if (lstat && lstat.isSymbolicLink()) {
          try {
            stat = fs.statSync(abs);
          } catch (er) {
            stat = lstat;
          }
        } else {
          stat = lstat;
        }
      }

      this.statCache[abs] = stat;
      var c = true;
      if (stat) c = stat.isDirectory() ? 'DIR' : 'FILE';
      this.cache[abs] = this.cache[abs] || c;
      if (needDir && c === 'FILE') return false;
      return c;
    };

    GlobSync.prototype._mark = function (p) {
      return common.mark(this, p);
    };

    GlobSync.prototype._makeAbs = function (f) {
      return common.makeAbs(this, f);
    };

    // Returns a wrapper function that returns a wrapped callback
    // The wrapper function should do some stuff, and return a
    // presumably different callback function.
    // This makes sure that own properties are retained, so that
    // decorations and such are not lost along the way.
    var wrappy_1 = wrappy;

    function wrappy(fn, cb) {
      if (fn && cb) return wrappy(fn)(cb);
      if (typeof fn !== 'function') throw new TypeError('need wrapper function');
      Object.keys(fn).forEach(function (k) {
        wrapper[k] = fn[k];
      });
      return wrapper;

      function wrapper() {
        var args = new Array(arguments.length);

        for (var i = 0; i < args.length; i++) {
          args[i] = arguments[i];
        }

        var ret = fn.apply(this, args);
        var cb = args[args.length - 1];

        if (typeof ret === 'function' && ret !== cb) {
          Object.keys(cb).forEach(function (k) {
            ret[k] = cb[k];
          });
        }

        return ret;
      }
    }

    var once_1 = wrappy_1(once);
    var strict = wrappy_1(onceStrict);
    once.proto = once(function () {
      Object.defineProperty(Function.prototype, 'once', {
        value: function () {
          return once(this);
        },
        configurable: true
      });
      Object.defineProperty(Function.prototype, 'onceStrict', {
        value: function () {
          return onceStrict(this);
        },
        configurable: true
      });
    });

    function once(fn) {
      var f = function () {
        if (f.called) return f.value;
        f.called = true;
        return f.value = fn.apply(this, arguments);
      };

      f.called = false;
      return f;
    }

    function onceStrict(fn) {
      var f = function () {
        if (f.called) throw new Error(f.onceError);
        f.called = true;
        return f.value = fn.apply(this, arguments);
      };

      var name = fn.name || 'Function wrapped with `once`';
      f.onceError = name + " shouldn't be called more than once";
      f.called = false;
      return f;
    }
    once_1.strict = strict;

    var reqs = Object.create(null);
    var inflight_1 = wrappy_1(inflight);

    function inflight(key, cb) {
      if (reqs[key]) {
        reqs[key].push(cb);
        return null;
      } else {
        reqs[key] = [cb];
        return makeres(key);
      }
    }

    function makeres(key) {
      return once_1(function RES() {
        var cbs = reqs[key];
        var len = cbs.length;
        var args = slice(arguments); // XXX It's somewhat ambiguous whether a new callback added in this
        // pass should be queued for later execution if something in the
        // list of callbacks throws, or if it should just be discarded.
        // However, it's such an edge case that it hardly matters, and either
        // choice is likely as surprising as the other.
        // As it happens, we do go ahead and schedule it for later execution.

        try {
          for (var i = 0; i < len; i++) {
            cbs[i].apply(null, args);
          }
        } finally {
          if (cbs.length > len) {
            // added more in the interim.
            // de-zalgo, just in case, but don't call again.
            cbs.splice(0, len);
            process.nextTick(function () {
              RES.apply(null, args);
            });
          } else {
            delete reqs[key];
          }
        }
      });
    }

    function slice(args) {
      var length = args.length;
      var array = [];

      for (var i = 0; i < length; i++) array[i] = args[i];

      return array;
    }

    //
    // 1. Get the minimatch set
    // 2. For each pattern in the set, PROCESS(pattern, false)
    // 3. Store matches per-set, then uniq them
    //
    // PROCESS(pattern, inGlobStar)
    // Get the first [n] items from pattern that are all strings
    // Join these together.  This is PREFIX.
    //   If there is no more remaining, then stat(PREFIX) and
    //   add to matches if it succeeds.  END.
    //
    // If inGlobStar and PREFIX is symlink and points to dir
    //   set ENTRIES = []
    // else readdir(PREFIX) as ENTRIES
    //   If fail, END
    //
    // with ENTRIES
    //   If pattern[n] is GLOBSTAR
    //     // handle the case where the globstar match is empty
    //     // by pruning it out, and testing the resulting pattern
    //     PROCESS(pattern[0..n] + pattern[n+1 .. $], false)
    //     // handle other cases.
    //     for ENTRY in ENTRIES (not dotfiles)
    //       // attach globstar + tail onto the entry
    //       // Mark that this entry is a globstar match
    //       PROCESS(pattern[0..n] + ENTRY + pattern[n .. $], true)
    //
    //   else // not globstar
    //     for ENTRY in ENTRIES (not dotfiles, unless pattern[n] is dot)
    //       Test ENTRY against pattern[n]
    //       If fails, continue
    //       If passes, PROCESS(pattern[0..n] + item + pattern[n+1 .. $])
    //
    // Caveat:
    //   Cache all stats and readdirs results to minimize syscall.  Since all
    //   we ever care about is existence and directory-ness, we can just keep
    //   `true` for files, and [children,...] for directories, or `false` for
    //   things that don't exist.

    var glob_1 = glob;
    var Minimatch$3 = minimatch_1.Minimatch;
    var EE = events.EventEmitter;
    var alphasort$2 = common.alphasort;
    var alphasorti$2 = common.alphasorti;
    var setopts$2 = common.setopts;
    var ownProp$2 = common.ownProp;
    var childrenIgnored$2 = common.childrenIgnored;
    var isIgnored$2 = common.isIgnored;

    function glob(pattern, options, cb) {
      if (typeof options === 'function') cb = options, options = {};
      if (!options) options = {};

      if (options.sync) {
        if (cb) throw new TypeError('callback provided to sync glob');
        return sync(pattern, options);
      }

      return new Glob$1(pattern, options, cb);
    }

    glob.sync = sync;
    var GlobSync$1 = glob.GlobSync = sync.GlobSync; // old api surface

    glob.glob = glob;

    function extend(origin, add) {
      if (add === null || typeof add !== 'object') {
        return origin;
      }

      var keys = Object.keys(add);
      var i = keys.length;

      while (i--) {
        origin[keys[i]] = add[keys[i]];
      }

      return origin;
    }

    glob.hasMagic = function (pattern, options_) {
      var options = extend({}, options_);
      options.noprocess = true;
      var g = new Glob$1(pattern, options);
      var set = g.minimatch.set;
      if (!pattern) return false;
      if (set.length > 1) return true;

      for (var j = 0; j < set[0].length; j++) {
        if (typeof set[0][j] !== 'string') return true;
      }

      return false;
    };

    glob.Glob = Glob$1;
    inherits(Glob$1, EE);

    function Glob$1(pattern, options, cb) {
      if (typeof options === 'function') {
        cb = options;
        options = null;
      }

      if (options && options.sync) {
        if (cb) throw new TypeError('callback provided to sync glob');
        return new GlobSync$1(pattern, options);
      }

      if (!(this instanceof Glob$1)) return new Glob$1(pattern, options, cb);
      setopts$2(this, pattern, options);
      this._didRealPath = false; // process each pattern in the minimatch set

      var n = this.minimatch.set.length; // The matches are stored as {<filename>: true,...} so that
      // duplicates are automagically pruned.
      // Later, we do an Object.keys() on these.
      // Keep them as a list so we can fill in when nonull is set.

      this.matches = new Array(n);

      if (typeof cb === 'function') {
        cb = once_1(cb);
        this.on('error', cb);
        this.on('end', function (matches) {
          cb(null, matches);
        });
      }

      var self = this;
      this._processing = 0;
      this._emitQueue = [];
      this._processQueue = [];
      this.paused = false;
      if (this.noprocess) return this;
      if (n === 0) return done();
      var sync = true;

      for (var i = 0; i < n; i++) {
        this._process(this.minimatch.set[i], i, false, done);
      }

      sync = false;

      function done() {
        --self._processing;

        if (self._processing <= 0) {
          if (sync) {
            process.nextTick(function () {
              self._finish();
            });
          } else {
            self._finish();
          }
        }
      }
    }

    Glob$1.prototype._finish = function () {
      assert(this instanceof Glob$1);
      if (this.aborted) return;
      if (this.realpath && !this._didRealpath) return this._realpath();
      common.finish(this);
      this.emit('end', this.found);
    };

    Glob$1.prototype._realpath = function () {
      if (this._didRealpath) return;
      this._didRealpath = true;
      var n = this.matches.length;
      if (n === 0) return this._finish();
      var self = this;

      for (var i = 0; i < this.matches.length; i++) this._realpathSet(i, next);

      function next() {
        if (--n === 0) self._finish();
      }
    };

    Glob$1.prototype._realpathSet = function (index, cb) {
      var matchset = this.matches[index];
      if (!matchset) return cb();
      var found = Object.keys(matchset);
      var self = this;
      var n = found.length;
      if (n === 0) return cb();
      var set = this.matches[index] = Object.create(null);
      found.forEach(function (p, i) {
        // If there's a problem with the stat, then it means that
        // one or more of the links in the realpath couldn't be
        // resolved.  just return the abs value in that case.
        p = self._makeAbs(p);
        fs_realpath.realpath(p, self.realpathCache, function (er, real) {
          if (!er) set[real] = true;else if (er.syscall === 'stat') set[p] = true;else self.emit('error', er); // srsly wtf right here

          if (--n === 0) {
            self.matches[index] = set;
            cb();
          }
        });
      });
    };

    Glob$1.prototype._mark = function (p) {
      return common.mark(this, p);
    };

    Glob$1.prototype._makeAbs = function (f) {
      return common.makeAbs(this, f);
    };

    Glob$1.prototype.abort = function () {
      this.aborted = true;
      this.emit('abort');
    };

    Glob$1.prototype.pause = function () {
      if (!this.paused) {
        this.paused = true;
        this.emit('pause');
      }
    };

    Glob$1.prototype.resume = function () {
      if (this.paused) {
        this.emit('resume');
        this.paused = false;

        if (this._emitQueue.length) {
          var eq = this._emitQueue.slice(0);

          this._emitQueue.length = 0;

          for (var i = 0; i < eq.length; i++) {
            var e = eq[i];

            this._emitMatch(e[0], e[1]);
          }
        }

        if (this._processQueue.length) {
          var pq = this._processQueue.slice(0);

          this._processQueue.length = 0;

          for (var i = 0; i < pq.length; i++) {
            var p = pq[i];
            this._processing--;

            this._process(p[0], p[1], p[2], p[3]);
          }
        }
      }
    };

    Glob$1.prototype._process = function (pattern, index, inGlobStar, cb) {
      assert(this instanceof Glob$1);
      assert(typeof cb === 'function');
      if (this.aborted) return;
      this._processing++;

      if (this.paused) {
        this._processQueue.push([pattern, index, inGlobStar, cb]);

        return;
      } //console.error('PROCESS %d', this._processing, pattern)
      // Get the first [n] parts of pattern that are all strings.


      var n = 0;

      while (typeof pattern[n] === 'string') {
        n++;
      } // now n is the index of the first one that is *not* a string.
      // see if there's anything else


      var prefix;

      switch (n) {
        // if not, then this is rather simple
        case pattern.length:
          this._processSimple(pattern.join('/'), index, cb);

          return;

        case 0:
          // pattern *starts* with some non-trivial item.
          // going to readdir(cwd), but not include the prefix in matches.
          prefix = null;
          break;

        default:
          // pattern has some string bits in the front.
          // whatever it starts with, whether that's 'absolute' like /foo/bar,
          // or 'relative' like '../baz'
          prefix = pattern.slice(0, n).join('/');
          break;
      }

      var remain = pattern.slice(n); // get the list of entries.

      var read;
      if (prefix === null) read = '.';else if (pathIsAbsolute(prefix) || pathIsAbsolute(pattern.join('/'))) {
        if (!prefix || !pathIsAbsolute(prefix)) prefix = '/' + prefix;
        read = prefix;
      } else read = prefix;

      var abs = this._makeAbs(read); //if ignored, skip _processing


      if (childrenIgnored$2(this, read)) return cb();
      var isGlobStar = remain[0] === minimatch_1.GLOBSTAR;
      if (isGlobStar) this._processGlobStar(prefix, read, abs, remain, index, inGlobStar, cb);else this._processReaddir(prefix, read, abs, remain, index, inGlobStar, cb);
    };

    Glob$1.prototype._processReaddir = function (prefix, read, abs, remain, index, inGlobStar, cb) {
      var self = this;

      this._readdir(abs, inGlobStar, function (er, entries) {
        return self._processReaddir2(prefix, read, abs, remain, index, inGlobStar, entries, cb);
      });
    };

    Glob$1.prototype._processReaddir2 = function (prefix, read, abs, remain, index, inGlobStar, entries, cb) {
      // if the abs isn't a dir, then nothing can match!
      if (!entries) return cb(); // It will only match dot entries if it starts with a dot, or if
      // dot is set.  Stuff like @(.foo|.bar) isn't allowed.

      var pn = remain[0];
      var negate = !!this.minimatch.negate;
      var rawGlob = pn._glob;
      var dotOk = this.dot || rawGlob.charAt(0) === '.';
      var matchedEntries = [];

      for (var i = 0; i < entries.length; i++) {
        var e = entries[i];

        if (e.charAt(0) !== '.' || dotOk) {
          var m;

          if (negate && !prefix) {
            m = !e.match(pn);
          } else {
            m = e.match(pn);
          }

          if (m) matchedEntries.push(e);
        }
      } //console.error('prd2', prefix, entries, remain[0]._glob, matchedEntries)


      var len = matchedEntries.length; // If there are no matched entries, then nothing matches.

      if (len === 0) return cb(); // if this is the last remaining pattern bit, then no need for
      // an additional stat *unless* the user has specified mark or
      // stat explicitly.  We know they exist, since readdir returned
      // them.

      if (remain.length === 1 && !this.mark && !this.stat) {
        if (!this.matches[index]) this.matches[index] = Object.create(null);

        for (var i = 0; i < len; i++) {
          var e = matchedEntries[i];

          if (prefix) {
            if (prefix !== '/') e = prefix + '/' + e;else e = prefix + e;
          }

          if (e.charAt(0) === '/' && !this.nomount) {
            e = path$1.join(this.root, e);
          }

          this._emitMatch(index, e);
        } // This was the last one, and no stats were needed


        return cb();
      } // now test all matched entries as stand-ins for that part
      // of the pattern.


      remain.shift();

      for (var i = 0; i < len; i++) {
        var e = matchedEntries[i];
        var newPattern;

        if (prefix) {
          if (prefix !== '/') e = prefix + '/' + e;else e = prefix + e;
        }

        this._process([e].concat(remain), index, inGlobStar, cb);
      }

      cb();
    };

    Glob$1.prototype._emitMatch = function (index, e) {
      if (this.aborted) return;
      if (isIgnored$2(this, e)) return;

      if (this.paused) {
        this._emitQueue.push([index, e]);

        return;
      }

      var abs = pathIsAbsolute(e) ? e : this._makeAbs(e);
      if (this.mark) e = this._mark(e);
      if (this.absolute) e = abs;
      if (this.matches[index][e]) return;

      if (this.nodir) {
        var c = this.cache[abs];
        if (c === 'DIR' || Array.isArray(c)) return;
      }

      this.matches[index][e] = true;
      var st = this.statCache[abs];
      if (st) this.emit('stat', e, st);
      this.emit('match', e);
    };

    Glob$1.prototype._readdirInGlobStar = function (abs, cb) {
      if (this.aborted) return; // follow all symlinked directories forever
      // just proceed as if this is a non-globstar situation

      if (this.follow) return this._readdir(abs, false, cb);
      var lstatkey = 'lstat\0' + abs;
      var self = this;
      var lstatcb = inflight_1(lstatkey, lstatcb_);
      if (lstatcb) fs.lstat(abs, lstatcb);

      function lstatcb_(er, lstat) {
        if (er && er.code === 'ENOENT') return cb();
        var isSym = lstat && lstat.isSymbolicLink();
        self.symlinks[abs] = isSym; // If it's not a symlink or a dir, then it's definitely a regular file.
        // don't bother doing a readdir in that case.

        if (!isSym && lstat && !lstat.isDirectory()) {
          self.cache[abs] = 'FILE';
          cb();
        } else self._readdir(abs, false, cb);
      }
    };

    Glob$1.prototype._readdir = function (abs, inGlobStar, cb) {
      if (this.aborted) return;
      cb = inflight_1('readdir\0' + abs + '\0' + inGlobStar, cb);
      if (!cb) return; //console.error('RD %j %j', +inGlobStar, abs)

      if (inGlobStar && !ownProp$2(this.symlinks, abs)) return this._readdirInGlobStar(abs, cb);

      if (ownProp$2(this.cache, abs)) {
        var c = this.cache[abs];
        if (!c || c === 'FILE') return cb();
        if (Array.isArray(c)) return cb(null, c);
      }

      var self = this;
      fs.readdir(abs, readdirCb(this, abs, cb));
    };

    function readdirCb(self, abs, cb) {
      return function (er, entries) {
        if (er) self._readdirError(abs, er, cb);else self._readdirEntries(abs, entries, cb);
      };
    }

    Glob$1.prototype._readdirEntries = function (abs, entries, cb) {
      if (this.aborted) return; // if we haven't asked to stat everything, then just
      // assume that everything in there exists, so we can avoid
      // having to stat it a second time.

      if (!this.mark && !this.stat) {
        for (var i = 0; i < entries.length; i++) {
          var e = entries[i];
          if (abs === '/') e = abs + e;else e = abs + '/' + e;
          this.cache[e] = true;
        }
      }

      this.cache[abs] = entries;
      return cb(null, entries);
    };

    Glob$1.prototype._readdirError = function (f, er, cb) {
      if (this.aborted) return; // handle errors, and cache the information

      switch (er.code) {
        case 'ENOTSUP': // https://github.com/isaacs/node-glob/issues/205

        case 'ENOTDIR':
          // totally normal. means it *does* exist.
          var abs = this._makeAbs(f);

          this.cache[abs] = 'FILE';

          if (abs === this.cwdAbs) {
            var error = new Error(er.code + ' invalid cwd ' + this.cwd);
            error.path = this.cwd;
            error.code = er.code;
            this.emit('error', error);
            this.abort();
          }

          break;

        case 'ENOENT': // not terribly unusual

        case 'ELOOP':
        case 'ENAMETOOLONG':
        case 'UNKNOWN':
          this.cache[this._makeAbs(f)] = false;
          break;

        default:
          // some unusual error.  Treat as failure.
          this.cache[this._makeAbs(f)] = false;

          if (this.strict) {
            this.emit('error', er); // If the error is handled, then we abort
            // if not, we threw out of here

            this.abort();
          }

          if (!this.silent) console.error('glob error', er);
          break;
      }

      return cb();
    };

    Glob$1.prototype._processGlobStar = function (prefix, read, abs, remain, index, inGlobStar, cb) {
      var self = this;

      this._readdir(abs, inGlobStar, function (er, entries) {
        self._processGlobStar2(prefix, read, abs, remain, index, inGlobStar, entries, cb);
      });
    };

    Glob$1.prototype._processGlobStar2 = function (prefix, read, abs, remain, index, inGlobStar, entries, cb) {
      //console.error('pgs2', prefix, remain[0], entries)
      // no entries means not a dir, so it can never have matches
      // foo.txt/** doesn't match foo.txt
      if (!entries) return cb(); // test without the globstar, and with every child both below
      // and replacing the globstar.

      var remainWithoutGlobStar = remain.slice(1);
      var gspref = prefix ? [prefix] : [];
      var noGlobStar = gspref.concat(remainWithoutGlobStar); // the noGlobStar pattern exits the inGlobStar state

      this._process(noGlobStar, index, false, cb);

      var isSym = this.symlinks[abs];
      var len = entries.length; // If it's a symlink, and we're in a globstar, then stop

      if (isSym && inGlobStar) return cb();

      for (var i = 0; i < len; i++) {
        var e = entries[i];
        if (e.charAt(0) === '.' && !this.dot) continue; // these two cases enter the inGlobStar state

        var instead = gspref.concat(entries[i], remainWithoutGlobStar);

        this._process(instead, index, true, cb);

        var below = gspref.concat(entries[i], remain);

        this._process(below, index, true, cb);
      }

      cb();
    };

    Glob$1.prototype._processSimple = function (prefix, index, cb) {
      // XXX review this.  Shouldn't it be doing the mounting etc
      // before doing stat?  kinda weird?
      var self = this;

      this._stat(prefix, function (er, exists) {
        self._processSimple2(prefix, index, er, exists, cb);
      });
    };

    Glob$1.prototype._processSimple2 = function (prefix, index, er, exists, cb) {
      //console.error('ps2', prefix, exists)
      if (!this.matches[index]) this.matches[index] = Object.create(null); // If it doesn't exist, then just mark the lack of results

      if (!exists) return cb();

      if (prefix && pathIsAbsolute(prefix) && !this.nomount) {
        var trail = /[\/\\]$/.test(prefix);

        if (prefix.charAt(0) === '/') {
          prefix = path$1.join(this.root, prefix);
        } else {
          prefix = path$1.resolve(this.root, prefix);
          if (trail) prefix += '/';
        }
      }

      if (process.platform === 'win32') prefix = prefix.replace(/\\/g, '/'); // Mark this as a match

      this._emitMatch(index, prefix);

      cb();
    }; // Returns either 'DIR', 'FILE', or false


    Glob$1.prototype._stat = function (f, cb) {
      var abs = this._makeAbs(f);

      var needDir = f.slice(-1) === '/';
      if (f.length > this.maxLength) return cb();

      if (!this.stat && ownProp$2(this.cache, abs)) {
        var c = this.cache[abs];
        if (Array.isArray(c)) c = 'DIR'; // It exists, but maybe not how we need it

        if (!needDir || c === 'DIR') return cb(null, c);
        if (needDir && c === 'FILE') return cb(); // otherwise we have to stat, because maybe c=true
        // if we know it exists, but not what it is.
      }

      var exists;
      var stat = this.statCache[abs];

      if (stat !== undefined) {
        if (stat === false) return cb(null, stat);else {
          var type = stat.isDirectory() ? 'DIR' : 'FILE';
          if (needDir && type === 'FILE') return cb();else return cb(null, type, stat);
        }
      }

      var self = this;
      var statcb = inflight_1('stat\0' + abs, lstatcb_);
      if (statcb) fs.lstat(abs, statcb);

      function lstatcb_(er, lstat) {
        if (lstat && lstat.isSymbolicLink()) {
          // If it's a symlink, then treat it as the target, unless
          // the target does not exist, then treat it as a file.
          return fs.stat(abs, function (er, stat) {
            if (er) self._stat2(f, abs, null, lstat, cb);else self._stat2(f, abs, er, stat, cb);
          });
        } else {
          self._stat2(f, abs, er, lstat, cb);
        }
      }
    };

    Glob$1.prototype._stat2 = function (f, abs, er, stat, cb) {
      if (er && (er.code === 'ENOENT' || er.code === 'ENOTDIR')) {
        this.statCache[abs] = false;
        return cb();
      }

      var needDir = f.slice(-1) === '/';
      this.statCache[abs] = stat;
      if (abs.slice(-1) === '/' && stat && !stat.isDirectory()) return cb(null, false, stat);
      var c = true;
      if (stat) c = stat.isDirectory() ? 'DIR' : 'FILE';
      this.cache[abs] = this.cache[abs] || c;
      if (needDir && c === 'FILE') return cb();
      return cb(null, c, stat);
    };

    /* eslint no-new-wrappers: 0 */

    'use strict';

    var shellMethods = Object.create(shell);
    var extend$1 = Object.assign; // Check if we're running under electron

    var isElectron = Boolean(process.versions.electron); // Module globals (assume no execPath by default)

    var DEFAULT_CONFIG = {
      fatal: false,
      globOptions: {},
      maxdepth: 255,
      noglob: false,
      silent: false,
      verbose: false,
      execPath: null,
      bufLength: 64 * 1024 // 64KB

    };
    var config = {
      reset: function () {
        Object.assign(this, DEFAULT_CONFIG);

        if (!isElectron) {
          this.execPath = process.execPath;
        }
      },
      resetForTesting: function () {
        this.reset();
        this.silent = true;
      }
    };
    config.reset();
    var config_1 = config; // Note: commands should generally consider these as read-only values.

    var state = {
      error: null,
      errorCode: 0,
      currentCmd: 'shell.js'
    };
    var state_1 = state;
    delete process.env.OLDPWD; // initially, there's no previous directory
    // Reliably test if something is any sort of javascript object

    function isObject(a) {
      return typeof a === 'object' && a !== null;
    }

    var isObject_1 = isObject;

    function log() {
      /* istanbul ignore next */
      if (!config.silent) {
        console.error.apply(console, arguments);
      }
    }

    var log_1 = log; // Converts strings to be equivalent across all platforms. Primarily responsible
    // for making sure we use '/' instead of '\' as path separators, but this may be
    // expanded in the future if necessary

    function convertErrorOutput(msg) {
      if (typeof msg !== 'string') {
        throw new TypeError('input must be a string');
      }

      return msg.replace(/\\/g, '/');
    }

    var convertErrorOutput_1 = convertErrorOutput; // Shows error message. Throws if config.fatal is true

    function error(msg, _code, options) {
      // Validate input
      if (typeof msg !== 'string') throw new Error('msg must be a string');
      var DEFAULT_OPTIONS = {
        continue: false,
        code: 1,
        prefix: state.currentCmd + ': ',
        silent: false
      };

      if (typeof _code === 'number' && isObject(options)) {
        options.code = _code;
      } else if (isObject(_code)) {
        // no 'code'
        options = _code;
      } else if (typeof _code === 'number') {
        // no 'options'
        options = {
          code: _code
        };
      } else if (typeof _code !== 'number') {
        // only 'msg'
        options = {};
      }

      options = Object.assign({}, DEFAULT_OPTIONS, options);
      if (!state.errorCode) state.errorCode = options.code;
      var logEntry = convertErrorOutput(options.prefix + msg);
      state.error = state.error ? state.error + '\n' : '';
      state.error += logEntry; // Throw an error, or log the entry

      if (config.fatal) throw new Error(logEntry);
      if (msg.length > 0 && !options.silent) log(logEntry);

      if (!options.continue) {
        throw {
          msg: 'earlyExit',
          retValue: new ShellString('', state.error, state.errorCode)
        };
      }
    }

    var error_1 = error; //@
    //@ ### ShellString(str)
    //@
    //@ Examples:
    //@
    //@ ```javascript
    //@ var foo = ShellString('hello world');
    //@ ```
    //@
    //@ Turns a regular string into a string-like object similar to what each
    //@ command returns. This has special methods, like `.to()` and `.toEnd()`.

    function ShellString(stdout, stderr, code) {
      var that;

      if (stdout instanceof Array) {
        that = stdout;
        that.stdout = stdout.join('\n');
        if (stdout.length > 0) that.stdout += '\n';
      } else {
        that = new String(stdout);
        that.stdout = stdout;
      }

      that.stderr = stderr;
      that.code = code; // A list of all commands that can appear on the right-hand side of a pipe
      // (populated by calls to common.wrap())

      pipeMethods.forEach(function (cmd) {
        that[cmd] = shellMethods[cmd].bind(that);
      });
      return that;
    }

    var ShellString_1 = ShellString; // Returns {'alice': true, 'bob': false} when passed a string and dictionary as follows:
    //   parseOptions('-a', {'a':'alice', 'b':'bob'});
    // Returns {'reference': 'string-value', 'bob': false} when passed two dictionaries of the form:
    //   parseOptions({'-r': 'string-value'}, {'r':'reference', 'b':'bob'});
    // Throws an error when passed a string that does not start with '-':
    //   parseOptions('a', {'a':'alice'}); // throws

    function parseOptions(opt, map, errorOptions) {
      // Validate input
      if (typeof opt !== 'string' && !isObject(opt)) {
        throw new Error('options must be strings or key-value pairs');
      } else if (!isObject(map)) {
        throw new Error('parseOptions() internal error: map must be an object');
      } else if (errorOptions && !isObject(errorOptions)) {
        throw new Error('parseOptions() internal error: errorOptions must be object');
      }

      if (opt === '--') {
        // This means there are no options.
        return {};
      } // All options are false by default


      var options = {};
      Object.keys(map).forEach(function (letter) {
        var optName = map[letter];

        if (optName[0] !== '!') {
          options[optName] = false;
        }
      });
      if (opt === '') return options; // defaults

      if (typeof opt === 'string') {
        if (opt[0] !== '-') {
          throw new Error("Options string must start with a '-'");
        } // e.g. chars = ['R', 'f']


        var chars = opt.slice(1).split('');
        chars.forEach(function (c) {
          if (c in map) {
            var optionName = map[c];

            if (optionName[0] === '!') {
              options[optionName.slice(1)] = false;
            } else {
              options[optionName] = true;
            }
          } else {
            error('option not recognized: ' + c, errorOptions || {});
          }
        });
      } else {
        // opt is an Object
        Object.keys(opt).forEach(function (key) {
          // key is a string of the form '-r', '-d', etc.
          var c = key[1];

          if (c in map) {
            var optionName = map[c];
            options[optionName] = opt[key]; // assign the given value
          } else {
            error('option not recognized: ' + c, errorOptions || {});
          }
        });
      }

      return options;
    }

    var parseOptions_1 = parseOptions; // Expands wildcards with matching (ie. existing) file names.
    // For example:
    //   expand(['file*.js']) = ['file1.js', 'file2.js', ...]
    //   (if the files 'file1.js', 'file2.js', etc, exist in the current dir)

    function expand$1(list) {
      if (!Array.isArray(list)) {
        throw new TypeError('must be an array');
      }

      var expanded = [];
      list.forEach(function (listEl) {
        // Don't expand non-strings
        if (typeof listEl !== 'string') {
          expanded.push(listEl);
        } else {
          var ret;

          try {
            ret = glob_1.sync(listEl, config.globOptions); // if nothing matched, interpret the string literally

            ret = ret.length > 0 ? ret : [listEl];
          } catch (e) {
            // if glob fails, interpret the string literally
            ret = [listEl];
          }

          expanded = expanded.concat(ret);
        }
      });
      return expanded;
    }

    var expand_1 = expand$1; // Normalizes Buffer creation, using Buffer.alloc if possible.
    // Also provides a good default buffer length for most use cases.

    var buffer = typeof Buffer.alloc === 'function' ? function (len) {
      return Buffer.alloc(len || config.bufLength);
    } : function (len) {
      return new Buffer(len || config.bufLength);
    };
    var buffer_1 = buffer; // Normalizes _unlinkSync() across platforms to match Unix behavior, i.e.
    // file can be unlinked even if it's read-only, see https://github.com/joyent/node/issues/3006

    function unlinkSync(file) {
      try {
        fs.unlinkSync(file);
      } catch (e) {
        // Try to override file permission

        /* istanbul ignore next */
        if (e.code === 'EPERM') {
          fs.chmodSync(file, '0666');
          fs.unlinkSync(file);
        } else {
          throw e;
        }
      }
    }

    var unlinkSync_1 = unlinkSync; // wrappers around common.statFollowLinks and common.statNoFollowLinks that clarify intent
    // and improve readability

    function statFollowLinks() {
      return fs.statSync.apply(fs, arguments);
    }

    var statFollowLinks_1 = statFollowLinks;

    function statNoFollowLinks() {
      return fs.lstatSync.apply(fs, arguments);
    }

    var statNoFollowLinks_1 = statNoFollowLinks; // e.g. 'shelljs_a5f185d0443ca...'

    function randomFileName() {
      function randomHash(count) {
        if (count === 1) {
          return parseInt(16 * Math.random(), 10).toString(16);
        }

        var hash = '';

        for (var i = 0; i < count; i++) {
          hash += randomHash(1);
        }

        return hash;
      }

      return 'shelljs_' + randomHash(20);
    }

    var randomFileName_1 = randomFileName; // Common wrapper for all Unix-like commands that performs glob expansion,
    // command-logging, and other nice things

    function wrap(cmd, fn, options) {
      options = options || {};
      return function () {
        var retValue = null;
        state.currentCmd = cmd;
        state.error = null;
        state.errorCode = 0;

        try {
          var args = [].slice.call(arguments, 0); // Log the command to stderr, if appropriate

          if (config.verbose) {
            console.error.apply(console, [cmd].concat(args));
          } // If this is coming from a pipe, let's set the pipedValue (otherwise, set
          // it to the empty string)


          state.pipedValue = this && typeof this.stdout === 'string' ? this.stdout : '';

          if (options.unix === false) {
            // this branch is for exec()
            retValue = fn.apply(this, args);
          } else {
            // and this branch is for everything else
            if (isObject(args[0]) && args[0].constructor.name === 'Object') {// a no-op, allowing the syntax `touch({'-r': file}, ...)`
            } else if (args.length === 0 || typeof args[0] !== 'string' || args[0].length <= 1 || args[0][0] !== '-') {
              args.unshift(''); // only add dummy option if '-option' not already present
            } // flatten out arrays that are arguments, to make the syntax:
            //    `cp([file1, file2, file3], dest);`
            // equivalent to:
            //    `cp(file1, file2, file3, dest);`


            args = args.reduce(function (accum, cur) {
              if (Array.isArray(cur)) {
                return accum.concat(cur);
              }

              accum.push(cur);
              return accum;
            }, []); // Convert ShellStrings (basically just String objects) to regular strings

            args = args.map(function (arg) {
              if (isObject(arg) && arg.constructor.name === 'String') {
                return arg.toString();
              }

              return arg;
            }); // Expand the '~' if appropriate

            var homeDir = os.homedir();
            args = args.map(function (arg) {
              if (typeof arg === 'string' && arg.slice(0, 2) === '~/' || arg === '~') {
                return arg.replace(/^~/, homeDir);
              }

              return arg;
            }); // Perform glob-expansion on all arguments after globStart, but preserve
            // the arguments before it (like regexes for sed and grep)

            if (!config.noglob && options.allowGlobbing === true) {
              args = args.slice(0, options.globStart).concat(expand$1(args.slice(options.globStart)));
            }

            try {
              // parse options if options are provided
              if (isObject(options.cmdOptions)) {
                args[0] = parseOptions(args[0], options.cmdOptions);
              }

              retValue = fn.apply(this, args);
            } catch (e) {
              /* istanbul ignore else */
              if (e.msg === 'earlyExit') {
                retValue = e.retValue;
              } else {
                throw e; // this is probably a bug that should be thrown up the call stack
              }
            }
          }
        } catch (e) {
          /* istanbul ignore next */
          if (!state.error) {
            // If state.error hasn't been set it's an error thrown by Node, not us - probably a bug...
            e.name = 'ShellJSInternalError';
            throw e;
          }

          if (config.fatal) throw e;
        }

        if (options.wrapOutput && (typeof retValue === 'string' || Array.isArray(retValue))) {
          retValue = new ShellString(retValue, state.error, state.errorCode);
        }

        state.currentCmd = 'shell.js';
        return retValue;
      };
    } // wrap


    var wrap_1 = wrap; // This returns all the input that is piped into the current command (or the
    // empty string, if this isn't on the right-hand side of a pipe

    function _readFromPipe() {
      return state.pipedValue;
    }

    var readFromPipe = _readFromPipe;
    var DEFAULT_WRAP_OPTIONS = {
      allowGlobbing: true,
      canReceivePipe: false,
      cmdOptions: null,
      globStart: 1,
      pipeOnly: false,
      wrapOutput: true,
      unix: true
    }; // This is populated during plugin registration

    var pipeMethods = []; // Register a new ShellJS command

    function _register(name, implementation, wrapOptions) {
      wrapOptions = wrapOptions || {}; // Validate options

      Object.keys(wrapOptions).forEach(function (option) {
        if (!DEFAULT_WRAP_OPTIONS.hasOwnProperty(option)) {
          throw new Error("Unknown option '" + option + "'");
        }

        if (typeof wrapOptions[option] !== typeof DEFAULT_WRAP_OPTIONS[option]) {
          throw new TypeError("Unsupported type '" + typeof wrapOptions[option] + "' for option '" + option + "'");
        }
      }); // If an option isn't specified, use the default

      wrapOptions = Object.assign({}, DEFAULT_WRAP_OPTIONS, wrapOptions);

      if (shell[name]) {
        throw new Error('Command `' + name + '` already exists');
      }

      if (wrapOptions.pipeOnly) {
        wrapOptions.canReceivePipe = true;
        shellMethods[name] = wrap(name, implementation, wrapOptions);
      } else {
        shell[name] = wrap(name, implementation, wrapOptions);
      }

      if (wrapOptions.canReceivePipe) {
        pipeMethods.push(name);
      }
    }

    var register = _register;
    var common$1 = {
      extend: extend$1,
      config: config_1,
      state: state_1,
      isObject: isObject_1,
      log: log_1,
      convertErrorOutput: convertErrorOutput_1,
      error: error_1,
      ShellString: ShellString_1,
      parseOptions: parseOptions_1,
      expand: expand_1,
      buffer: buffer_1,
      unlinkSync: unlinkSync_1,
      statFollowLinks: statFollowLinks_1,
      statNoFollowLinks: statNoFollowLinks_1,
      randomFileName: randomFileName_1,
      wrap: wrap_1,
      readFromPipe: readFromPipe,
      register: register
    };

    var commands = ['cat', 'cd', 'chmod', 'cp', 'dirs', 'echo', 'exec', 'find', 'grep', 'head', 'ln', 'ls', 'mkdir', 'mv', 'pwd', 'rm', 'sed', 'set', 'sort', 'tail', 'tempdir', 'test', 'to', 'toEnd', 'touch', 'uniq', 'which'];

    //@ ### error()
    //@
    //@ Tests if error occurred in the last command. Returns a truthy value if an
    //@ error returned, or a falsy value otherwise.
    //@
    //@ **Note**: do not rely on the
    //@ return value to be an error message. If you need the last error message, use
    //@ the `.stderr` attribute from the last command's return value instead.

    function error$1() {
      return common$1.state.error;
    }

    var error_1$1 = error$1;

    // ShellJS
    // Unix shell commands on top of Node's API
    //
    // Copyright (c) 2012 Artur Adib
    // http://github.com/shelljs/shelljs
    //
    //@
    //@ All commands run synchronously, unless otherwise stated.
    //@ All commands accept standard bash globbing characters (`*`, `?`, etc.),
    //@ compatible with the [node `glob` module](https://github.com/isaacs/node-glob).
    //@
    //@ For less-commonly used commands and features, please check out our [wiki
    //@ page](https://github.com/shelljs/shelljs/wiki).
    //@
    // Include the docs for all the default commands
    //@commands
    // Load all default commands

    commands.forEach(function (command) {
      commonjsRequire('./src/' + command);
    }); //@
    //@ ### exit(code)
    //@
    //@ Exits the current process with the given exit `code`.

    var exit = process.exit; //@include ./src/error

    var error$2 = error_1$1; //@include ./src/common

    var ShellString$1 = common$1.ShellString; //@
    //@ ### env['VAR_NAME']
    //@
    //@ Object containing environment variables (both getter and setter). Shortcut
    //@ to `process.env`.

    var env = process.env; //@
    //@ ### Pipes
    //@
    //@ Examples:
    //@
    //@ ```javascript
    //@ grep('foo', 'file1.txt', 'file2.txt').sed(/o/g, 'a').to('output.txt');
    //@ echo('files with o\'s in the name:\n' + ls().grep('o'));
    //@ cat('test.js').exec('node'); // pipe to exec() call
    //@ ```
    //@
    //@ Commands can send their output to another command in a pipe-like fashion.
    //@ `sed`, `grep`, `cat`, `exec`, `to`, and `toEnd` can appear on the right-hand
    //@ side of a pipe. Pipes can be chained.
    //@
    //@ ## Configuration
    //@

    var config$1 = common$1.config; //@
    //@ ### config.silent
    //@
    //@ Example:
    //@
    //@ ```javascript
    //@ var sh = require('shelljs');
    //@ var silentState = sh.config.silent; // save old silent state
    //@ sh.config.silent = true;
    //@ /* ... */
    //@ sh.config.silent = silentState; // restore old silent state
    //@ ```
    //@
    //@ Suppresses all command output if `true`, except for `echo()` calls.
    //@ Default is `false`.
    //@
    //@ ### config.fatal
    //@
    //@ Example:
    //@
    //@ ```javascript
    //@ require('shelljs/global');
    //@ config.fatal = true; // or set('-e');
    //@ cp('this_file_does_not_exist', '/dev/null'); // throws Error here
    //@ /* more commands... */
    //@ ```
    //@
    //@ If `true`, the script will throw a Javascript error when any shell.js
    //@ command encounters an error. Default is `false`. This is analogous to
    //@ Bash's `set -e`.
    //@
    //@ ### config.verbose
    //@
    //@ Example:
    //@
    //@ ```javascript
    //@ config.verbose = true; // or set('-v');
    //@ cd('dir/');
    //@ rm('-rf', 'foo.txt', 'bar.txt');
    //@ exec('echo hello');
    //@ ```
    //@
    //@ Will print each command as follows:
    //@
    //@ ```
    //@ cd dir/
    //@ rm -rf foo.txt bar.txt
    //@ exec echo hello
    //@ ```
    //@
    //@ ### config.globOptions
    //@
    //@ Example:
    //@
    //@ ```javascript
    //@ config.globOptions = {nodir: true};
    //@ ```
    //@
    //@ Use this value for calls to `glob.sync()` instead of the default options.
    //@
    //@ ### config.reset()
    //@
    //@ Example:
    //@
    //@ ```javascript
    //@ var shell = require('shelljs');
    //@ // Make changes to shell.config, and do stuff...
    //@ /* ... */
    //@ shell.config.reset(); // reset to original state
    //@ // Do more stuff, but with original settings
    //@ /* ... */
    //@ ```
    //@
    //@ Reset `shell.config` to the defaults:
    //@
    //@ ```javascript
    //@ {
    //@   fatal: false,
    //@   globOptions: {},
    //@   maxdepth: 255,
    //@   noglob: false,
    //@   silent: false,
    //@   verbose: false,
    //@ }
    //@ ```

    var shell = {
      exit: exit,
      error: error$2,
      ShellString: ShellString$1,
      env: env,
      config: config$1
    };

    const dir = '../nodeApi';
    var exec = shell.exec;
    var startPoint = './server.js';
    var rConfig = './rollup.config.js';
    var oPath = './_tmp-build.js';
    fs.readdir(dir, (err, files) => {
      var filelist = files;
      const generateBundle = `npx rollup ${startPoint} -c ${rConfig} --silent -o ${oPath}`;
      exec(generateBundle);
      let rSource = JSON.parse(fs.readFileSync(oPath + '.map')).sources; // console.log('logging srcs', source);

      rSource = rSource.map(str => path$1.resolve(str));
      console.log('Cleaned Source', rSource);
      files.forEach(file => {
        if (fs.statSync(path$1.join(dir, file)).isDirectory()) {
          // console.log('here 1' , filelist, file, path.join(dir, file));
          filelist = walkSync_1(dir + '/' + file, {
            includeBasePath: true
          }); // console.log('aa', filelist);
        } else {
          console.log('here 2');
          filelist.push(file);
        }
      });
      filelist = filelist.map(file => path$1.resolve(file));
      var map = {};
      rSource.forEach(file => map[file] = true);
      console.log('mappp', map);
      var unused = filelist.filter(file => map[file] !== true);
      console.log('unused', unused);
      fs.writeFile('./output.txt', unused); // console.log('here', filelist.sort().reverse())
    });
    var Untitled2 = {};

    const a = () => console.log('testing my function');

    const b = () => console.log('prabha not believing');

    const express = require('express');

    const app = express();

    const request = require('request');

    const fetch = require("node-fetch");
    app.listen(7900, () => {
      console.log('server Up and running');
    });
    app.get('/test', async (_req, _res, _next) => {
      fetch('https://github.com/').then(res => res.text());
    });
    app.get('/getDetails', async (_req, res, _next) => {
      request('https://demo.ghost.io/ghost/api/v2/content/tags?include=tags,authors&key=22444f78447824223cefc48062', (err, _resp, body) => {
        if (err) {
          return console.log(err);
        }

        return res.json(body);
      });
    });
    app.stop;

}(fs, path$1, os, util, events, assert));
//# sourceMappingURL=_tmp-build.js.map
