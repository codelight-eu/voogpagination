/*
                 _                                        
     _   _   _  |_) _.  _  o ._   _. _|_ o  _  ._    o  _ 
 \/ (_) (_) (_| |  (_| (_| | | | (_|  |_ | (_) | | o | _> 
             _|         _|                          _|    

 Version: 1.0.0
  Author: Mats-Joonas Kulla
 Website: codelight.eu
    Docs: https://github.com/codelight-eu/voogPagination
    Repo: https://github.com/codelight-eu/voogPagination
  Issues: https://github.com/codelight-eu/voogPagination/issues

 */

(function ($) {
  'use strict';
  var VoogPagination = window.VoogPagination || {};


  VoogPagination = (function () {

    // Instance unique identifier
    var instanceUid = 0;

    function VoogPagination(element, settings) {

      var _ = this, dataSettings;
      // dataSettings are settings that are passed through the html element data attribute

      // Default settings
      _.defaults = {
        perPage: 12, // number, how many items to display per page
        itemType: 'article', // string, which type of items to paginate, possible values are: 'article', 'element' and 'comment'
        parentId: null, // string, id of the parent page from where paginated items are fetched, e.g. your blog id or elements page id
        queryVars: null, // string, used to append query vars to the end of the query
        startingPage: 1, // number, which page is displayed at start
        renderItemsOnFirstFetch: true, // boolean, default true, whether to render items on initialize, set to false if you prefer to rrender them in liquid template instead
        requestUrlBuilder: null, // function,
        itemTemplate: null, // function, should return an html string
        itemWrapper: null, // function, useful for when you don't want to override entire item template, but just want to wrap single item in some html
        dateFormatter: null, // function, should return a string
        useHistoryPushState: true, // boolean, whether the plugin should use the history push state api if supported, default true
        enablePageUrls: true, // boolean, change page urls in sync with the pagination, default true
        urlFormat: 'fullQuery', // string, possible values: 'fullQuery', 'singleQueryVar', 'hash'
        queryKey: 'page', // string, only applicable if the urlFormat is 'singleQueryVar'
        hashPrefix: 'page-', // string, only applicable if the urlFormat is 'hash'
        hashSuffix: '', // string, only applicable if urlFormat is 'hash'
        navigation: { // object, settings object for the navigation
          container: null, // string, className or id of the container into where the navigation is rendered, by default, navigation is rendered at the bottom of the main container
          totalLength: 9, // number, the total number of navItems (excluding first and last page links)
          edgeLength: 1, // number, how many edge navitems should be rendered
        },
        defaultNotifications: {
          noItems: 'No items to display.',
          error: 'Oops! Something went wrong! <br> Try refreshing the page or check back soon',
        },
        ajaxErrorHandler: null, // function, called on api fetch errors
        messageTemplate: null, // function, used for rendering notifications
        eventNameSpace: '.vp', // string
        initClass: 'voogPagination-initialized', // string, html class attribute added to the pagination wrapper on initialization,
        cachePages: true, // boolean, whether to cache the fetched pages
      };

      // The initial state
      _.initials = {
        isFetching: false,
        totalPages: 0,
      };


      $.extend(_, _.initials);

      // non configurable variables
      _.$pager = $(element);

      // Settings from element's data attribute
      dataSettings = $(element).data('pagination') || {};

      // merge defaults, user passed settings and finally datasettings into the one big options object
      // dataSettings are merged last and thus override any previous settings
      _.options = $.extend(true, {}, _.defaults, settings, dataSettings);

      _.currentPage = _.options.startingPage;
      _.$renderedItems = null;
      _.renderedPageLinks = [];
      _.apiEndPoint = '/admin/api/articles';
      _.itemTemplate = null; // is later used to select correct item template

      if (_.options.itemType === 'element') {
        _.apiEndPoint = '/admin/api/elements';
      } else if (_.options.itemType === 'comment') {
        _.apiEndPoint = '/admin/api/articles/' + _.options.parentId + '/comments';
      }

      // Whether to enable the pushstate api or not
      if (history.pushState && _.options.useHistoryPushState) {
        _.pushStateEnabled = true;
      }

      // Increment instance unique identifier
      _.instanceUid = instanceUid++;

      // A simple way to check for HTML strings
      // Strict HTML recognition (must start with <)
      // Extracted from jQuery v1.11 source
      _.htmlExpr = /^(?:\s*(<[\w\W]+>)[^>]*)$/;

      _.isFirstFetch = true;

      _.initialized = false;

      _.init();
    }

    return VoogPagination;

  }());

  // A helper for getting parameters form query strings by name
  // http://stackoverflow.com/questions/901115/how-can-i-get-query-string-values-in-javascript
  VoogPagination.prototype.getQueryParamByName = function (name, url) {
    name = name.replace(/[\[\]]/g, "\\$&");
    var regex = new RegExp("[?&]" + name + "(=([^&#]*)|&|#|$)"),
      results = regex.exec(url);
    if (!results) return null;
    if (!results[2]) return '';
    return decodeURIComponent(results[2].replace(/\+/g, " "));
  };

  // http://stackoverflow.com/questions/5999118/add-or-update-query-string-parameter#answer-6021027
  VoogPagination.prototype.updateQueryStringParameter = function (uri, key, value) {
    var re = new RegExp("([?&])" + key + "=.*?(&|$)", "i");
    var separator = uri.indexOf('?') !== -1 ? "&" : "?";
    if (uri.match(re)) {
      return uri.replace(re, '$1' + key + "=" + value + '$2');
    }
    else {
      return uri + separator + key + "=" + value;
    }
  };

  VoogPagination.prototype.formatDate = function (dateString) {
    var date = new Date(dateString);
    var day = date.getDate();
    var month = date.getMonth() + 1;
    var year = date.getFullYear();
    if (day < 10) {
      day = '0' + day;
    }
    if (month < 10) {
      month = '0' + month;
    }
    return day + '.' + month + '.' + year;
  };

  // A helper for parsing http link headers
  // Original author: https://gist.github.com/deiu
  // https://gist.github.com/deiu/9335803

  /**
   * @param {obj} header 
   */
  VoogPagination.prototype.parseLinkHeader = function (header) {
    // Unquote string (utility)
    function unquote(value) {
      if (value.charAt(0) == '"' && value.charAt(value.length - 1) == '"') return value.substring(1, value.length - 1);
      return value;
    }

    var linkexp = /<[^>]*>\s*(\s*;\s*[^\(\)<>@,;:"\/\[\]\?={} \t]+=(([^\(\)<>@,;:"\/\[\]\?={} \t]+)|("[^"]*")))*(,|$)/g;
    var paramexp = /[^\(\)<>@,;:"\/\[\]\?={} \t]+=(([^\(\)<>@,;:"\/\[\]\?={} \t]+)|("[^"]*"))/g;

    var matches = header.match(linkexp);
    var rels = new Object();
    for (var i = 0; i < matches.length; i++) {
      var split = matches[i].split('>');
      var href = split[0].substring(1);
      var ps = split[1];
      var link = new Object();
      link.href = href;
      var s = ps.match(paramexp);
      for (var j = 0; j < s.length; j++) {
        var p = s[j];
        var paramsplit = p.split('=');
        var name = paramsplit[0];
        link[name] = unquote(paramsplit[1]);
      }

      if (link.rel != undefined) {
        rels[link.rel] = link;
      }
    }

    return rels;
  };

  VoogPagination.prototype.parseQueryFromUrl = function (url) {
    return url.slice(url.indexOf('?'));
  };

  VoogPagination.prototype.updateBrowserUrl = function (query, pageNr, urlFormat) {
    var _ = this;
    _.$pager.trigger('beforeUrlUpdate' + _.options.eventNameSpace, [_, {
      query: query,
      pageNr: pageNr,
      urlFormat: urlFormat,
    }]);

    urlFormat = urlFormat || _.options.urlFormat;
    if (!_.options.enablePageUrls) {
      return;
    }

    if (urlFormat === 'fullQuery' || urlFormat === 'singleQueryVar') {
      if (urlFormat === 'singleQueryVar') {
        query = '?' + _.options.queryKey + '=' + pageNr;
      }
      if (_.pushStateEnabled) {
        history.pushState(null, null, query);
      } else {
        document.location = document.location.pathname + query;
      }
    }

    if (urlFormat === 'hash') {
      var hash = '#' + _.options.hashPrefix + pageNr + _.options.hashSuffix;
      document.location.hash = hash;
    }

    _.$pager.trigger('afterUrlUpdate' + _.options.eventNameSpace, {
      query: query,
      pageNr: pageNr,
      urlFormat: urlFormat,
    });
  };

  VoogPagination.prototype.defaultRequestUrlBuilder = function (page, options) {
    /*
      This is a helper function for building Voog api urls, returns a query string
    */
    var _ = this;
    var paginationQuery = '?page=' + page + '&per_page=' + options.perPage;
    var endPoint = _.apiEndPoint;
    var requestUrl = endPoint + paginationQuery;

    if (options.parentId) {
      requestUrl = requestUrl + '&page_id=' + options.parentId;
    }

    if (options.itemType === 'article') {
      requestUrl = requestUrl + '&include_details=true&s=article.published_at.$desc';
    }
    if (options.itemType === 'element') {
      requestUrl = endPoint + paginationQuery + '&include_values=true';
      if (options.parentId) {
        requestUrl = requestUrl + '&q.element.page_id=' + options.parentId;
      }
    } if (options.itemType === 'comment') {
      requestUrl = endPoint + paginationQuery + '&q.comment.spam.$eq=false';
    }

    if (options.queryVars) {
      requestUrl = requestUrl + '&' + options.queryVars;
    }

    return requestUrl;
  };

  VoogPagination.prototype.buildRequestUrl = function (page) {
    var _ = this;
    var requestUrl;
    if (_.options.requestUrlBuilder) {
      requestUrl = _.options.requestUrlBuilder(page, _.options);
    } else {
      requestUrl = _.defaultRequestUrlBuilder(page, _.options);
    }

    return requestUrl;
  };

  VoogPagination.prototype.fetchPage = function (target, updateUrl) {
    var _ = this;

    var requestUrl;
    updateUrl = updateUrl !== false;
    var pageNr;
    if (isNaN(target)) {
      requestUrl = target;
      pageNr = parseInt(_.getQueryParamByName('page', requestUrl));
    } else {
      requestUrl = _.buildRequestUrl(target);
      pageNr = target;
    }

    if (_.isFetching) {
      return;
    }

    // if urls are in query format, but the pushstate is disabled,
    // then fall back to simple page reloads
    if (!_.isFirstFetch) {
      if (_.options.urlFormat === 'fullQuery' || _.options.urlFormat === 'singleQueryVar') {
        if (!_.pushStateEnabled) {
          if (updateUrl) {
            _.updateBrowserUrl(_.parseQueryFromUrl(requestUrl), pageNr);
            return;
          }
        }
      }
    }

    _.isFetching = true;

    _.$pager.trigger('fetchStart' + _.options.eventNameSpace, [_, {
      requestUrl: requestUrl,
      pageNr: pageNr,
    }]);

    $.get({
      url: requestUrl,
      cache: _.options.cachePages,
    })
      .done(function (res, status, xhr) {
        _.$pager.trigger('fetchDone' + _.options.eventNameSpace, [_, {
          res: res,
          status: status,
          xhr: xhr,
        }]);

        if (status !== 'success') {
          _.ajaxErrorHandler(_.renderMessage.bind(_), { res: res, status: status, xhr: xhr });
          return;
        }

        // update current page state
        _.currentPage = pageNr;
        _.renderController(res, status, xhr);

        if (updateUrl) {
          _.updateBrowserUrl(_.parseQueryFromUrl(requestUrl), pageNr);
        }
        _.isFirstFetch = false;
      })
      .fail(function (xhr, status, errorThrown) {
        _.$pager.trigger('fetchFail' + _.options.eventNameSpace, [_, {
          xhr: xhr,
          status: status,
          errorThrown: errorThrown,
        }]);
        _.ajaxErrorHandler(_.renderMessage.bind(_), { res: errorThrown, status: status, xhr: xhr });
      })
      .always(function () {
        _.isFetching = false;
      });
  };

  // templates for single items
  VoogPagination.prototype.articleTemplate = function (item, dateFormatter) {
    var timeBlock = '<time class="post-date" datetime="' + item.published_at + '">' + dateFormatter(item.published_at) + '</time>';
    var authorBlock = '<span class="post-author" data-author-url="' + item.author.url + '" data-author-id="' + item.author.id + '">' + item.author.name + '</span>';
    var commentsBlock = '<a href="' + item.public_url + '#comments" class="comments-count no-comments"> ' + item.public_comments_count + ' </a>';
    if (parseInt(item.public_comments_count)) {
      commentsBlock = '<a href="' + item.public_url + '#comments" class="comments-count"> ' + item.public_comments_count + ' </a>';
    }
    var titleBlock = '<h1 class="post-title"><a href="' + item.public_url + '">' + item.title + '</a></h1>';
    var excerptBlock = '<div class="post-excerpt content-formatted">' + item.excerpt + '</div>';
    var spacer = '<span class="separator"></span>';

    var templateString = '<article class="post" data-post-id="' + item.id + '" data-parent-id="' + item.page.id + '">' +
      '<header class="post-header">' +
      '<section class="post-meta">' +
      authorBlock +
      spacer +
      timeBlock +
      spacer +
      commentsBlock +
      titleBlock +
      '</section>' +
      '</header>' +
      '<section class="post-content">' +
      excerptBlock +
      '</section>' +
      '</article>';

    return templateString;
  };

  VoogPagination.prototype.elementTemplate = function (item) {
    var titleBlock = '<h1 class="element-title"><a href="' + item.public_url + '">' + item.title + '</a></h1>';
    var templateString = '<article class="element" data-element-id="' + item.id + '" data-parent-id="' + item.page.id + '">' +
      titleBlock +
      '</div>';
    return templateString;
  };

  VoogPagination.prototype.commentTemplate = function (item, dateFormatter) {
    var authorBlock = '<span class="comment-author">' + item.author + '</span>';
    var timeBlock = '<time class="comment-date" datetime="' + item.created_at + '">' + dateFormatter(item.created_at) + '</time>';
    var spacer = '<span class="separator"></span>';
    var body = '<span class="comment-body">' + item.body + '</span>';

    var templateString = '<div class="comment edy-site-blog-comment" data-comment-id="' + item.id + '" data-parent-id="' + item.article.id + '">' +
      '<div class="comment-inner">' +
      '<header class="comment-header">' +
      authorBlock +
      spacer +
      timeBlock +
      '</header>' +
      '<section>' +
      body +
      '</section>' +
      '</div>' +
      '</div>';
    return templateString;
  };

  /**
   * Message template, used for displaying errors and notifications
   */
  VoogPagination.prototype.messageTemplate = function (message, type) {
    type = type || 'info';
    var typeClass = 'notification-info';
    if (type === 'error') {
      typeClass = 'notification-error';
    }
    var templateString = '<div class="notification ' + typeClass + '">' +
      message +
      '</div>';
    return templateString;
  };

  // item rendering
  VoogPagination.prototype.renderItems = function (items) {
    var _ = this;
    var $items = $();
    if (_.options.itemTemplate) {
      _.itemTemplate = _.options.itemTemplate;
    } else {
      if (_.options.itemType === 'article') {
        _.itemTemplate = _.articleTemplate;
      } else if (_.options.itemType === 'element') {
        _.itemTemplate = _.elementTemplate;
      } else if (_.options.itemType === 'comment') {
        _.itemTemplate = _.commentTemplate;
      }
    }


    var dateFormatter = _.options.dateFormatter || _.formatDate;

    items.forEach(function (itemData, index) {
      var itemHtmlString = _.itemTemplate(itemData, dateFormatter, index, _);
      var $item = $(itemHtmlString);
      if (_.options.itemWrapper) {
        $item = $(_.options.itemWrapper(itemHtmlString, index, _));
      }
      $items = $items.add($item);
    });

    // clear old items before appending new ones
    if (_.$renderedItems) {
      _.$renderedItems.remove();
    }

    // render items
    _.$pager.html($items);

    // keep reference of rendered items
    _.$renderedItems = $items;
  };


  /**
   * Returns an HTML string of a single nav item
   */
  VoogPagination.prototype.navItemTemplate = function (args) {
    var url = args.url;
    var content = args.content;
    var itemType = args.itemType;
    var state = args.state;
    var stateClass = args.stateClass || '';
    var modClass = args.modClass || '';

    if (state === 'disabled') {
      stateClass = 'st-disabled';
    } else if (state === 'current') {
      stateClass = 'st-active';
    }

    if (itemType === 'prev') {
      content = '&lt;';
    } else if (itemType === 'next') {
      content = '&gt;';
    } else if (itemType === 'ellipsis') {
      content = '...';
      modClass = 'pageNav_link-ellipsis';
    }

    var navItem = '<div class="pageNav_item">' +
      '<div class="pageNav_link ' + modClass + ' ' + stateClass + '">' +
      content +
      '</div>' +
      '</div>';
    if (url) {
      navItem = '<div class="pageNav_item">' +
        '<a href="' + url + '" class="pageNav_link ' + modClass + ' ' + stateClass + '">' +
        content +
        '</a>' +
        '</div>';
    }

    return navItem;
  };

  /**
   * Uses navItemTemplate to create a single nav item jQuery object
   */
  VoogPagination.prototype.createNavItem = function (args) {
    var _ = this;
    var pageNr = args.pageNr;
    var itemType = args.itemType;
    var links = args.links;
    var url = false;
    var state = pageNr === _.currentPage ? 'current' : null;
    if (pageNr) {
      url = _.parseQueryFromUrl(_.buildRequestUrl(pageNr));
    }

    var params = {
      url: url,
      state: state,
      itemType: itemType,
      content: pageNr,
    };

    // next and prev are special nav items and need different params
    if (itemType === 'next' || itemType === 'prev') {
      if (links[itemType]) {
        url = _.parseQueryFromUrl(links[itemType].href);
        state = null;
      } else {
        url = null;
        state = 'disabled';
      }
      params = {
        itemType: itemType,
        state: state,
        url: url,
      };
      pageNr = _.currentPage + 1;
      if (itemType === 'prev') {
        pageNr = _.currentPage - 1;
      }
    }

    var $navItem = $(_.navItemTemplate(params));

    var context = {
      origContext: _,
      pageNr: pageNr,
    };

    $navItem.find('a').on('click', function (e) {
      e.preventDefault();
      _.goToPage(this.pageNr);
    }.bind(context));

    return $navItem;
  };

  /**
   * Uses createNavItem to render all the pagination instances
   */
  VoogPagination.prototype.renderPagination = function (params) {
    var _ = this;
    var totalPages = params.totalPages;
    var currentPage = params.currentPage;
    var links = params.links;
    var containerSelector = _.options.navigation.container;
    var navLength = _.options.navigation.totalLength;
    var edgeLength = _.options.navigation.edgeLength;

    function renderPageLinks($container) {
      var $navContainer = $('<nav class="pageNav" role="navigation"></nav>');
      var $navList = $('<div class="pageNav_list"></div>');
      $container.append($navContainer);
      $navContainer.append($navList);

      // create and add prev item to pagination
      $navList.prepend(_.createNavItem({
        itemType: 'prev',
        links: links,
      }));

      // create and add page number links to pagination
      var rimLength = navLength - (edgeLength + 1);
      var middleLength = navLength - 2 * (edgeLength + 1);
      var i;
      if (totalPages < navLength) {
        for (i = 1; i <= totalPages; i++) {
          $navList.append(_.createNavItem({
            pageNr: i,
          }));
        }
      } else if (currentPage < rimLength) {
        for (i = 1; i <= rimLength; i++) {
          $navList.append(_.createNavItem({
            pageNr: i,
          }));
        }
        $navList.append(_.createNavItem({
          itemType: 'ellipsis',
        }));
        for (i = totalPages + 1 - edgeLength; i <= totalPages; i++) {
          $navList.append(_.createNavItem({
            pageNr: i,
          }));
        }
      } else if (currentPage > totalPages + 1 - rimLength) {
        for (i = 1; i <= edgeLength; i++) {
          $navList.append(_.createNavItem({
            pageNr: i,
          }));
        }
        $navList.append(_.createNavItem({
          itemType: 'ellipsis',
        }));
        for (i = totalPages + 1 - rimLength; i <= totalPages; i++) {
          $navList.append(_.createNavItem({
            pageNr: i,
          }));
        }
      } else {
        for (i = 1; i <= edgeLength; i++) {
          $navList.append(_.createNavItem({
            pageNr: i,
          }));
        }
        $navList.append(_.createNavItem({
          itemType: 'ellipsis',
        }));

        var startAt = currentPage - Math.floor(middleLength / 2);
        var endAt = currentPage + Math.floor(middleLength / 2);
        if (middleLength % 2 === 0) {
          endAt = currentPage + (Math.floor(middleLength / 2) - 1);
        }
        for (i = startAt; i <= endAt; i++) {
          $navList.append(_.createNavItem({
            pageNr: i,
          }));
        }
        $navList.append(_.createNavItem({
          itemType: 'ellipsis',
        }));
        for (i = totalPages + 1 - edgeLength; i <= totalPages; i++) {
          $navList.append(_.createNavItem({
            pageNr: i,
          }));
        }
      }


      // create and add next item to pagination
      $navList.append(_.createNavItem({
        itemType: 'next',
        links: links,
      }));


      function destroy() {
        $navContainer.remove();
      }

      return {
        destroy: destroy,
      };
    }

    // destroy previously rendered links
    if (_.renderedPageLinks.length !== -1) {
      _.renderedPageLinks.forEach(function (linkGroup) {
        linkGroup.destroy();
      });
    }

    if (containerSelector) {
      $(containerSelector).each(function () {
        var pageLinks = renderPageLinks($(this));
        // keep reference of the rendered pagelinks
        _.renderedPageLinks.push(pageLinks);
      });
    } else {
      var pageLinks = renderPageLinks(_.$pager);
      // keep reference of the rendered pagelinks
      _.renderedPageLinks.push(pageLinks);
    }

  };

  // renderController is called after a successful API fetch
  // it controls the item and pagination render order
  VoogPagination.prototype.renderController = function (res, status, xhr) {
    var _ = this;
    var params = {};
    _.totalPages = parseInt(xhr.getResponseHeader("X-Total-Pages"));
    params.totalPages = _.totalPages;
    params.currentPage = _.currentPage;
    params.links = _.parseLinkHeader(xhr.getResponseHeader('Link'));

    _.$pager.trigger('beforeRender' + _.options.eventNameSpace, [_, params]);

    // render API response items
    if (_.options.renderItemsOnFirstFetch || !_.isFirstFetch || _.currentPage > _.options.startingPage) {
      _.renderItems(res);
    }
    _.renderPagination(params);

    if (!_.initialized) {
      _.$pager.addClass(_.options.initClass);
      _.$pager.trigger('initialized' + _.options.eventNameSpace, [_]);
    }
    _.$pager.trigger('afterRender' + _.options.eventNameSpace, [_, params]);
  };

  /**
   * Used for displaying notification and error messages
   */
  VoogPagination.prototype.renderMessage = function (msgHtmlString) {
    var _ = this;
    var $msg = $(msgHtmlString);
    // clear old items before appending the message
    if (_.$renderedItems) {
      _.$renderedItems.remove();
    }
    // render message
    _.$pager.html($msg);

    // keep reference of rendered items/message
    _.$renderedItems = [];
    _.$renderedItems.push($msg);
  };

  /**
    * @callback renderer
    * @param {function} messageTemplate
    * @param {string} messageType
  */
  /**
   * @param {callback} renderer - responsible for rendering the error message
   * @param {Object} data - the response data
   */
  VoogPagination.prototype.ajaxErrorHandler = function (renderer, data) {
    var _ = this;
    var messageTemplate = _.options.messageTemplate || _.messageTemplate;
    if (_.options.ajaxErrorHandler) {
      _.options.ajaxErrorHandler(renderer, messageTemplate.bind(_), data);
    } else {
      renderer(messageTemplate(_.options.defaultNotifications.error), 'error');
    }
  };

  VoogPagination.prototype.currentInstance = function () {
    var _ = this;
    return _;
  };

  VoogPagination.prototype.goToPage = function (target) {
    var _ = this;
    _.fetchPage(target);
  };

  VoogPagination.prototype.goToNextPage = function () {
    var _ = this;
    if (_.currentPage === _.totalPages) {
      return;
    }
    _.fetchPage(_.currentPage + 1);
  };

  VoogPagination.prototype.goToPrevPage = function () {
    var _ = this;
    if (_.currentPage === 1) {
      return;
    }
    _.fetchPage(_.currentPage - 1);
  };

  VoogPagination.prototype.goToFirstPage = function () {
    var _ = this;
    _.fetchPage(1);
  };

  VoogPagination.prototype.goToLastPage = function () {
    var _ = this;
    if (_.currentPage === _.totalPages) {
      return;
    }
    _.fetchPage(_.totalPages);
  };

  VoogPagination.prototype.destroy = function (refresh) {
    var _ = this;
    if (!refresh) {
      _.$pager.trigger('beforeDestroy' + _.options.eventNameSpace, [_]);
    }

    _.renderedPageLinks.forEach(function (linkGroup) {
      linkGroup.destroy();
    });
    _.$renderedItems.each(function () {
      $(this).remove();
    });
    _.$pager.removeClass(_.options.initClass);

    if (!refresh) {
      _.$pager.trigger('afterDestroye' + _.options.eventNameSpace, [_]);
    }
  };

  VoogPagination.prototype.refresh = function () {
    var _ = this;
    _.$pager.trigger('refresh' + _.options.eventNameSpace, [_]);
    _.destroy(true);
    _.fetchPage(_.currentPage);
  };

  VoogPagination.prototype.loadStartingPage = function () {
    var _ = this;
    var query = window.location.search;
    var urlFormat = _.options.urlFormat;
    var pageNr;
    if (urlFormat === 'singleQueryVar' || urlFormat === 'fullQuery') {
      pageNr = parseInt(_.getQueryParamByName(_.options.queryKey, query));
    } else if (urlFormat === 'hash') {
      var hash = window.location.hash;
      if (hash) {
        var hashPrefix = _.options.hashPrefix;
        var hashSuffix = _.options.hashSuffix;
        var firstIndex = 0;
        var lastIndex = 0;
        if (hashPrefix) {
          firstIndex = hash.indexOf(hashPrefix) + hashPrefix.length;
        }
        if (hashSuffix) {
          lastIndex = hash.indexOf(hashSuffix);
        }

        if (firstIndex && lastIndex) {
          pageNr = hash.substring(firstIndex, lastIndex);
        } else if (firstIndex && !lastIndex) {
          pageNr = hash.substring(firstIndex);
        } else {
          pageNr = hash;
        }
        pageNr = parseInt(pageNr);
      }
    }

    if (pageNr) {
      if (urlFormat === 'fullQuery') {
        _.fetchPage(_.apiEndPoint + query, false);
      } else {
        _.fetchPage(pageNr, false);
      }
    } else {
      _.fetchPage(_.options.startingPage, false);
    }
  };

  VoogPagination.prototype.urlChangeListeners = function () {
    var _ = this;
    if (!_.pushStateEnabled) {
      return;
    }
    window.addEventListener('popstate', function () {
      _.loadStartingPage();
    });
  };

  VoogPagination.prototype.init = function () {

    var _ = this;

    if (!_.initialized) {
      // run the initial functions
      _.urlChangeListeners();
      _.loadStartingPage();
    }
  };

  $.fn.voogPagination = function () {
    var _ = this,
      opt = arguments[0],
      args = Array.prototype.slice.call(arguments, 1),
      l = _.length,
      i,
      ret;
    for (i = 0; i < l; i++) {
      if (typeof opt === 'object' || typeof opt === 'undefined') {
        _[i].voogPagination = new VoogPagination(_[i], opt);
      } else {
        ret = _[i].voogPagination[opt].apply(_[i].voogPagination, args);
      }
      if (typeof ret !== 'undefined') {
        return ret;
      }
    }
    return _;
  };

})(jQuery);