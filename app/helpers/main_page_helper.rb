module MainPageHelper
  
  # maximum of 9 elements: the first page, the last page, at least 2 before and after the current page,
  # and '...' when multiple pages are squeezed out. For example,
  # 1 2 3 4 5 6 7 ... 13
  # 1 ... 7 8 9 10 11 12 13
  # 1 ... 5 6 7 8 9 ... 13
  def pagination_links
    html = []
    top = @commented_games.total_pages
    cur = params[:page].to_i
    if (cur == nil or cur < 1 or cur > top)
      cur = 1
    end
    for page_number in 1..top
      if top > 9 && ((page_number == 2 && cur > 5) || (page_number == top - 1 && cur < top - 4))
        html << '...'
      elsif page_number == 1
        html << String(link_to_unless(cur == page_number, page_number))
      elsif page_number == top ||
           (page_number > cur - 3 && page_number < cur + 3) ||
           (cur < 6 && page_number < 8) ||
           (cur > top - 5 && page_number > top - 7)
        html << String(link_to_unless(cur == page_number, page_number, {:params => params.merge('page' => page_number)}))
      end
    end
    html.join('&nbsp;')
  end
end
