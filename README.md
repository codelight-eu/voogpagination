# voogPagination
voogPagination is a jQuery-based front-end pagination plugin for the Voog CMS. It utilizes Voog's public API (https://www.voog.com/developers/api) and can be used to paginate elements, articles and comments.
This plugin is js only, i.e. there are no default themes or CSS styles included.

## Getting started
You can either use a package manager or [download the latest release from this GitHub repo](releases/latest).

```sh
# Bower
bower install --save voogpagination

# NPM
npm install voogpagination
```

### Initializing
```html
<div class="js-paginatedArticles"></div>
```
```javascript
<script>
  $(document).ready(function() {
    var settings = {
      parentId: {{page.id}}
    };
    $('.js-paginatedArticles').voogPagination(settings);
  });
</script>
```

## Settings
Option | Type | Default | Description
------ | ---- | ------- | -----------
ajaxErrorHandler | function | null | Called on ajax request errors. See the [source](/src/voogpagination.js) and [examples](#ajax-error-handling) for reference.
cachePages | boolean | true | Whether to cache the fetched items.
dateFormatter | function | null | Overrides the itemTemplates function used for date formatting. See [examples](#custom-date-formatting) section for more info.
defaultNotifications | Object | {} | Contains the notification settings. All notifications are rendered inside the messageTemplate.
defaultNotifications.noItems | string | 'No items to display.' | Shown when there are no items to render.
defaultNotifications.error | string | `'Oops! Something went wrong! <br> Try refreshing the page or check back soon'` | Shown as a general error message. May contain html tags.
enablePageUrls | boolean | true | Whether to display pagination queries in the url.
eventNameSpace | string | '.vp' | Used to namespace voogPagination's events.
hashPrefix | string | 'page-' | Change the hash prefix. Only applicable if the urlFormat is set to `'hash'`.
hashSuffix | string | '' | Change the hash suffix. Only applicable if the urlFormat is set to `'hash'`.
initClass | string | 'voogPagination-initialized' | Html class attribute added to the pagination wrapper on initialization.
itemTemplate | function | null | Takes two aguments - item (either article, comment or element object) and dateFormatter (function). Has to return a string. See the [examples](#custom-item-templates) section and the [source](/src/voogpagination.js) for more info.
itemWrapper | function | null | Useful for when you don't want to override the entire item template, but just want to wrap every item in some html. See the [examples](#wrapping-paginated-items) section for more info.
itemType | string | 'article' | Which type of items to paginate, possible values are: `'article'`, `'element'` and `'comment'`.
messageTemplate | function | null | Used for rendering notifications. See the [examples](#custom-message-templates) section for more info.
navigation | Object | {} | Contains the navigation settings.
navigation.container | string | null | className or id of the container into where the navigation should be rendered. By default, navigation is rendered at the bottom of the items' parent element.
navigation.totalLength | number | 9 | The total number of navItems to render excluding thr first and last page links.
navigation.edgeLength | number | 1 | How many edge navitems should be rendered. ![ScreenShot](/screenshots/pagination_edges.png)
parentId | string | null | Id of the page from where the paginated items should be fetched, e.g. your blog id or elements page id. If you do not provide an id, all articles or elements will be fetched.
perPage | number | 12 | How many items to display per page.
queryKey | string | 'page' | Change the query prefix. Only applicable if the `urlFormat` is set to `'singleQueryVar'`.
queryVars | string | null | Useful for [filtering and sorting](#sorting-and-filtering) paginated items. See [Voog's documentation](https://www.voog.com/developers/api/basics/filters) for all the possible values.
renderItemsOnFirstFetch | boolean | true | Whether to render the paginated items on initialize. You might want to set this to `false` if you are already rendering the items in your template. See the [examples](#pre-rendering-in-liquid) for more info.
requestUrlBuilder | function | null | Used to override defaultRequestUrlBuilder. See the [source](/src/voogpagination.js) for more info. 
startingPage | number | 1 | Which page to display at start.
urlFormat | string | 'fullQuery' | In which format to display the query portion of the url. Possible values: `'fullQuery'`, `'singleQueryVar'`, `'hash'`.
useHistoryPushState | boolean | true | Whether to use browsers history push state api to keep reference of previous queries and enable the browsers back and forward button functionality.

## Methods
You can call methods through the voogPagination instance. e.g:
```javascript
$('.js-pagedArticles').voogPagination('goToPage', 4);
```

Method | Argument | Description
------ | -------- | -----------
currentInstance | | Returns the current voogPagination instance.
goToPage | target: int | Go to page by number.
goToNextPage | | Go to the next page.
goToPrevPage | | Go to the previous page.
goToFirstPage | | Go to the first page.
goToLastPage | | Go to the last page.
destroy | | Remove all the DOM nodes that were created by the current instance.
refresh | | Rerender everything.

## Events
Event | Params | Description
----- | ------ | -----------
beforeUrlUpdate | event, voogPagination, {query, pageNr, urlFormat} | Triggered before updating the url.
afterUrlUpdate | event, voogPagination, {query, pageNr, urlFormat} | Triggered after updating the url.
fetchStart | event, voogPagination, {requestUrl, pageNr} | Triggered before the ajax request.
fetchDone | event, voogPagination, {res, status, xhr} | Triggered in the jQuery ajax done callback.
fetchFail | event, voogPagination, {xhr, status, errorThrown} | Triggered in the jQuery ajax fail callback.
beforeRender | event, voogPagination, params | Triggered before rendering items and nav. 
initialized | event, voogPagination | Triggered after the plugin has been initialized. 
afterRender | event, voogPagination, params | Triggered after rendering the items and nav. 
beforeDestroy | event, voogPagination | Triggered before executing the destroy method.
afterDestroy | event, voogPagination | Triggered after executing the destroy method.

## Examples

### Paginating articles
```html
<div class="js-paginatedArticles"></div>
```
```javascript
<script>
  $(document).ready(function() {
    $('.js-paginatedArticles').voogPagination({
      parentId: {{page.id}},
    });
  });
</script>
```

### Paginating comments
```html
<div class="js-paginatedComments"></div>
```
```javascript
<script>
  $(document).ready(function() {
    $('.js-paginatedComments').voogPagination({
      itemType: 'comment',
      parentId: {{article.id}}
    });
  });
</script>
```

### Paginating elements
```html
<div class="js-paginatedItems"></div>
```
```javascript
<script>
  $(document).ready(function() {
    $('.js-paginatedItems').voogPagination({
      itemType: 'element',
      parentId: {{page.id}}
    });
  });
</script>
```

### Custom date formatting
Vanilla js
```javascript
var settings = {
  dateFormatter: function(dateString) {
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
  }
}
```

With [moment.js](https://momentjs.com/)
```javascript
var settings = {
  dateFormatter: function(dateString) {
    return moment.utc(item.values.datetime).format('DD.MM.YYYY');
  }
}
```

### Custom notifications
```javascript
var settings = {
  defaultNotifications: {
    noItems: 'There are no comments yet',
    error: 'Something went bork. <br> Try refreshing the page or check back soon'
  }
}
```

### Ajax error handling
```javascript
var settings = {
  ajaxErrorHandler: function (renderer, messageTemplate, data) {
    console.log(data);
    renderer(messageTemplate('Some witty and unhelpful error message', 'error'));
  }
}
```

### Custom item templates
A custom template for elements
```javascript
var settings = {
  itemTemplate: function (item, dateFormatter) {
    var title = '<div class="eventTile_title">' + item.title + '</div>';
    var category = '<div class="eventTile_category">' + item.values.category + '</div>';
    var date = '<div class="eventTile_info">' + dateFormatter(item.values.datetime) + '</div>';
    var location = '<div class="eventTile_location">' + item.values.location + '</div>';
    var button = '<div class="eventTile_button"><a href="' + item.public_url + '">Read more</a></div>';
    var templateString = '<div class="eventTile ' + item.values.category + '">' +
      title +
      category +
      date +
      location +
      button +
      '</div>';
    return templateString;
  }
}
```

### Custom message templates
```javascript
var settings = 
  messageTemplate = function (message, type) {
    type = type || 'info';
    var typeClass = 'notification-info';
    if (type === 'error') {
      typeClass = 'notification-error';
    }
    var templateString = '<div class="message ' + typeClass + '">' +
      message +
      '</div>';
    return templateString;
  }
}
```

### Wrapping paginated items
```javascript
var settings = {
  itemWrapper: function (item, index) {
    return '<div class="col-sm-4" data-item-nr="' + index + '">' + item + '</div>';
  }
}
```

### Navigation settings
```javascript
var settings = {
  navigation: {
    container: '.js-pageNav',
    totalLength: 6,
    edgeLength: 1
  }
}
```
### Sorting and filtering
```html
<div class="catFilter js-eventFilter">
  <label class="catFilter_item" for="category1">
    <input id="category1" type="radio" value="category-1" name="catFilter">
    Category 1
  </label>
  <label class="catFilter_item" for="category2">
    <input id="category2" type="radio" value="category-2" name="catFilter">
    Category 2
  </label>
  <label class="catFilter_item" for="category3">
    <input id="category3" type="radio" value="category-3" name="catFilter">
    Category 3
  </label>
</div>
```

```javascript
$('.js-eventFilter input').each(function (index, element) {
  $(element).change(function () {
    // Get current voogPaginations instance
    var paginationInstance = $('.js-pagedItems').voogPagination('currentInstance');

    // Update the settings dynamically
    paginationInstance.options.queryVars = 'q.element.values.category.$matches=' + 
      $(this).val() +
      '&q.element.values.datetime.$gteq=' +
      moment().format('YYYY-MM-DD') +
      '&s=element.values.datetime.$asc';

    // Fetch the first page using the new query vars.
    $('.js-pagedItems').voogPagination('goToFirstPage');
  });
});
```

### Pre rendering in liquid
```html
<div class="events js-paginatedEvents">
  {% elementscontext edicy_model="Event" %}
    {% for event in elements %}
      <div class="eventTile {{ event.category }}">
        <div class="eventTile_title" data-mh="eventTile">{{ event.title }}</div>
        <div class="eventTile_category" data-mh="eventTile">{{ event.category }}</div>
        <div class="eventTile_info" data-mh="eventTile">{{ event.datetime | date: "%Y.%m.%d %H:%M" }}</div>
        <div class="eventTile_button" data-mh="eventTile">
          <a href="{{ event.url }}">Read more</a>
        </div>
      </div>
    {% endfor %}
  {% endelementscontext %}
<div>
```
```javascript
<script>
  $(document).ready(function() {
    $('.js-paginatedEvents').voogPagination({
      itemType: 'element',
      parentId: {{page.id}},
      renderItemsOnFirstFetch: false
    });
  });
</script>
```

## Browser support
Browser | Version
------- | -------
Chrome | Latest
Firefox | Latest
IE | 10+ 
Edge | Latest
Safari | 6.1

## Dependencies
jQuery 1.7

## License
Copyright (c) 2017 Mats-Joonas Kulla

Licensed under the MIT license.
