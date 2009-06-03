module MainPageHelper
  
  # maximum of 9 elements: the first page, the last page, at least 2 before and after the current page,
  # and '...' when multiple pages are squeezed out. For example,
  # 1 2 3 4 5 6 7 ... 13
  # 1 ... 7 8 9 10 11 12 13
  # 1 ... 5 6 7 8 9 ... 13
  def pagination_links
    html = ''
    top = @commented_games.total_pages
    cur = params[:page].to_i
    if (cur == nil or cur < 1 or cur > top)
      cur = 1
    end
    for page_number in 1..@commented_games.total_pages
      if top > 9 and ((page_number == 2 and cur > 5) or (page_number == top - 1 and cur < top - 4))
        html << '...&nbsp;'
      elsif page_number == 1
        html << String(link_to_unless(cur == page_number, page_number)) << '&nbsp;'
      elsif page_number == top or
           (page_number > cur - 3 and page_number < cur + 3) or
           (cur < 6 and page_number < 8) or
           (cur > top - 5 and page_number > top - 7)
        html << String(link_to_unless(cur == page_number, page_number, {:params => params.merge('page' => page_number)})) << '&nbsp;'
      end
    end
    html
  end
end
