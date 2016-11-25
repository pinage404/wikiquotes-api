const WikiquoteApi = (($) => {
  const API_URL = 'https://en.wikiquote.org/w/api.php';

  return {
    /**
     * Query based on "titles" parameter and return page id.
     * If multiple page ids are returned, choose the first one.
     * Query includes "redirects" option to automatically traverse redirects.
     * All words will be capitalized as this generally yields more consistent results.
     */
    queryTitles: (titles, success, error) => {
      $.getJSON(API_URL, {
        format: 'json',
        action: 'query',
        redirects: '',
        titles: titles,
      }).done(result => {
        const pages = result.query.pages;
        let pageId = -1;

        $.each(pages, (k, v) => {
          let page = v;
          // api can return invalid recrods, these are marked as "missing"
          if (!('missing' in page)) {
            pageId = page.pageid;
            return false;
          }
        });

        if (pageId > 0) {
          success(pageId);
        } else {
          error('No results');
        }
      }).fail(() => error('Error processing your query'));
    },

    /**
     * Get the sections for a given page.
     * This makes parsing for quotes more manageable.
     * Returns an array of all "1.x" sections as these usually contain the quotes.
     * If no 1.x sections exists, returns section 1. Returns the titles that were used
     * in case there is a redirect.
     */
    getSectionsForPage: (pageId, success, error) => {
      $.getJSON(API_URL, {
        format: 'json',
        action: 'parse',
        prop: 'sections',
        pageid: pageId,
      }).done(result => {
        let sectionArray = [];
        const sections = result.parse.sections;

        $.each(sections, (k, v) => {
          const splitNum = v.number.split('.');
          if (splitNum.length > 1 && splitNum[0] === '1') {
            sectionArray.push(v.index);
          }
        });

        // Use section 1 if there are no "1.x" sections
        if (sectionArray.length === 0) {
          sectionArray.push('1');
        }
        success({ titles: result.parse.title, sections: sectionArray });
      }).fail(() => error('Error getting sections'));
    },

    /**
     * Get all quotes for a given section.  Most sections will be of the format:
     * <h3> title </h3>
     * <ul>
     *   <li>
     *     Quote text
     *     <ul>
     *       <li> additional info on the quote </li>
     *     </ul>
     *   </li>
     * <ul>
     * <ul> next quote etc... </ul>
     *
     * The quote may or may not contain sections inside <b /> tags.
     *
     * For quotes with bold sections, only the bold part is returned for brevity
     * (usually the bold part is more well known).
     * Otherwise the entire text is returned.  Returns the titles that were used
     * in case there is a redirect.
     */
    getQuotesForSection: (pageId, sectionIndex, success, error) => {
      $.getJSON(API_URL, {
        format: 'json',
        action: 'parse',
        noimages: '',
        pageid: pageId,
        section: sectionIndex,
      }).done(result => {
        const quotes = result.parse.text['*'];
        let quoteArray = [];

        // Find top level <li> only
        const lis = $(quotes).find('li:not(li li)');
        lis.each((i, el) => {
          // Remove all children that aren't <b>
          $(el).children().remove(':not(b)');
          const bolds = $(el).find('b');

          // If the section has bold text, use it.  Otherwise pull the plain text.
          if (bolds.length > 0) {
            quoteArray.push(bolds.html());
          } else {
            quoteArray.push($(el).html());
          }
        });

        success({ titles: result.parse.title, quotes: quoteArray });
      }).fail(() => error('Error getting quotes'));
    },

    /**
     * Get Wikipedia page for specific section
     * Usually section 0 includes personal Wikipedia page link
     */
    getWikiForSection: (title, pageId, sec, success, error) => {
      $.getJSON(API_URL, {
        format: 'json',
        action: 'parse',
        noimages: '',
        pageid: pageId,
        section: sec,
      }).done(result => {
        let wikilink;
        const iwl = result.parse.iwlinks;

        $.each(iwl, (i, v) => {
          const obj = v;
          if ((obj['*']).indexOf(title) !== -1) {
            wikilink = obj.url;
          }
        });

        success(wikilink);
      }).fail(() => error('Error getting quotes'));
    },

    /**
     * Search using opensearch api.  Returns an array of search results.
     */
    openSearch: (titles, success, error) => {
      $.getJSON(API_URL, {
        format: 'json',
        action: 'opensearch',
        namespace: 0,
        suggest: '',
        search: titles,
      })
      .done(result => success(result[1]))
      .fail(() => error('Error with opensearch for ' + titles));
    },

    /**
     * Get a random quote for the given title search.
     * This function searches for a page id for the given title, chooses a random
     * section from the list of sections for the page, and then chooses a random
     * quote from that section.  Returns the titles that were used in case there
     * is a redirect.
     */
    getRandomQuote: (titles, success, error) => {
      function chooseQuote(quotes) {
        const randomNum = Math.floor(Math.random() * quotes.quotes.length);
        success({ titles: quotes.titles, quote: quotes.quotes[randomNum] });
      }

      function getQuotes(pageId, sections) {
        const randomNum = Math.floor(Math.random() * sections.sections.length);
        this.getQuotesForSection(
          pageId, sections.sections[randomNum], chooseQuote, error
        );
      }

      function getSections(pageId) {
        this.getSectionsForPage(
          pageId, sections => getQuotes(pageId, sections), error
        );
      }

      this.queryTitles(titles, getSections, error);
    },

    /**
     * Capitalize the first letter of each word
     */
    capitalizeString: input => {
      const inputArray = input.split(' ');
      let output = [];
      $.each(inputArray, (k, v) => {
        output.push(v.charAt(0).toUpperCase() + v.slice(1));
      });
      return output.join(' ');
    },
  };
})(jQuery);
