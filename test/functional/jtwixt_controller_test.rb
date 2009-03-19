require File.dirname(__FILE__) + '/../test_helper'
require 'jtwixt_controller'

# Re-raise errors caught by the controller.
class JtwixtController; def rescue_action(e) raise e end; end

class JtwixtControllerTest < Test::Unit::TestCase
  def setup
    @controller = JtwixtController.new
    @request    = ActionController::TestRequest.new
    @response   = ActionController::TestResponse.new
  end

  # Replace this with your real tests.
  def test_truth
    assert true
  end
end
