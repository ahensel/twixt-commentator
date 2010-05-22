
#	Application
set :application, "twixt-commentator"
set :deploy_to, "/var/www/rails/#{application}"
set :runner, nil
set :user, "alan"

#	Settings
default_run_options[:pty] = true
set :use_sudo, true

#	Servers
set :domain, "yippy.local"
server domain, :app, :web, :db, :primary => true

#	Source Control
set :scm, :git
set :repository,  "ssh://yippy.local/var/git/twixt-commentator.git"

#	Passenger
namespace :passenger do
  desc "Restart Application"
  task :restart do
    run "touch #{current_path}/tmp/restart.txt"
  end
end

after :deploy, "passenger:restart"
