// Magically require any env variables defined in a local .env file.
// require('dotenv').config();
// Polyfill fetch.
require('isomorphic-fetch');
const queryString = require('query-string');

const baseAPIURL = 'https://bugzilla.mozilla.org/rest/bug';
const baseWEBURL = 'https://bugzilla.mozilla.org/buglist.cgi';
const priorities = ['--', 'P1', 'P2', 'P3', 'P4', 'P5'];
const severities = ['normal', '--', 'N/A', 'S1', 'S2', 'S3', 'S4'];
const products = ['Toolkit', 'WebExtensions'];

const defaultParams = {
  // The string for include_fields can be anything.
  // This is just to ensure it's not actually pulling any data since we only need a count.
  include_fields: 'whatever',
  resolution: '---',
  bug_status: ['UNCONFIRMED', 'NEW', 'ASSIGNED', 'REOPENED'],
  limit: 0,
};

function fetchIssueCount({ priority, product, bug_severity } = {}) {
  const params = { ...defaultParams, product, priority, bug_severity };
  if (params.bug_priority && params.bug_severity) {
    throw new Error('Query only severity or priority independently');
  }
  if (bug_severity) {
    delete params.priority;
  }
  if (priority) {
    delete params.bug_severity;
  }
  // console.log(JSON.stringify(params, null, 2));

  if (product === 'Toolkit') {
    params.component = 'Add-ons Manager';
  }
  const apiURL = `${baseAPIURL}?${queryString.stringify(params)}`;
  const webParams = { ...params };
  delete webParams.include_fields;
  const webURL = `${baseWEBURL}?${queryString.stringify(webParams)}`;
  // console.log(url);
  return fetch(apiURL, {
    headers: { 'Content-Type': 'application/json' },
  })
    .then((res) => res.json())
    .then((json) => {
      return { count: json.bugs.length, url: webURL };
    });
}

function getBugzillaIssueCounts() {
  const requests = [];
  const combinedData = {};

  for (const product of products) {
    combinedData[product] = {};

    for (const priority of priorities) {
      requests.push(
        fetchIssueCount({
          product,
          priority,
        }).then((result) => {
          let priorityLabel;
          switch (priority) {
            case '--':
              priorityLabel = 'default';
              break;
            default:
              priorityLabel = priority.toLowerCase();
          }
          combinedData[product][`priority-${priorityLabel}`] = result;
        }),
      );
    }

    for (const bug_severity of severities) {
      requests.push(
        fetchIssueCount({
          product,
          bug_severity,
        }).then((result) => {
          let severityLabel;
          switch (bug_severity) {
            case 'N/A':
              severityLabel = 'not-applicable';
              break;
            case '--':
              severityLabel = 'default';
              break;
            default:
              severityLabel = bug_severity.toLowerCase();
          }
          combinedData[product][`severity-${severityLabel}`] = result;
        }),
      );
    }

    requests.push(
      fetchIssueCount({
        product,
        bug_severity: null,
        priority: null,
      }).then((result) => {
        combinedData[product][`total`] = result;
      }),
    );
  }

  return Promise.all(requests).then(() => {
    return combinedData;
  });
}

module.exports = {
  getBugzillaIssueCounts,
};
