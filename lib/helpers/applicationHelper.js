
// Escape < and > only (same behaviour as Rails h2 helper)
function h2(html) {
  if (html == null) return '';
  return String(html).replace(/</g, '&lt;').replace(/>/g, '&gt;');
}



// Pagination helper
// Returns an array of page descriptors: { page: Number|null, label: String }
// (null page means '...' ellipsis)
function paginationLinks(currentPage, totalPages, buildUrl) {
  const cur = (currentPage == null || currentPage < 1 || currentPage > totalPages) ? 1 : currentPage;
  const top = totalPages;
  const parts = [];

  for (let pageNumber = 1; pageNumber <= top; pageNumber++) {
    if (top > 9 && ((pageNumber === 2 && cur > 5) || (pageNumber === top - 1 && cur < top - 4))) {
      parts.push({ page: null, label: '...' });
    } else if (
      pageNumber === 1 ||
      pageNumber === top ||
      (pageNumber > cur - 3 && pageNumber < cur + 3) ||
      (cur < 6 && pageNumber < 8) ||
      (cur > top - 5 && pageNumber > top - 7)
    ) {
      parts.push({ page: pageNumber, label: String(pageNumber), current: pageNumber === cur, url: buildUrl(pageNumber) });
    }
  }
  return parts;
}

module.exports = { h2, paginationLinks };
