xml.instruct! :xml, :version => "1.0"
xml.rss :version => "2.0" do
  xml.channel do
    xml.title "Twixt Commentator"
    xml.description "The latest comments on Twixt Commentator"
    xml.link formatted_all_comments_url(:rss)

    for comment in @comments
      xml.item do
        game = comment.game
        user = User.find(comment.user_id)
        rss_url = url_for(:only_path => false, :controller => 'rss_feed', :action => 'show', :id => comment)
        
        xml.title "Game #{game.lg_game_num}: #{h2(game.player1)} vs. #{h2(game.player2)} in #{game.tournament}"
        xml.description sanitize(comment.comment).gsub(/\n/, '<br/>')
        xml.pubDate comment.created_on.to_s(:rfc822)
        xml.link rss_url
        xml.guid rss_url
        xml.author h2(user.name)
      end
    end
  end
end
