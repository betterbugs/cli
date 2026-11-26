# Homebrew formula template for the betterbugs/tap tap.
#
# Do not edit the placeholders by hand. For every release, the public repo's
# publish workflow (packaging/public-repo/.github/workflows/publish.yml) runs
# packaging/homebrew/render-formula.mjs, which downloads the published npm
# tarball, computes its sha256, fills in __VERSION__ and __SHA256__, and
# attaches the finished betterbugs.rb to the GitHub release. Copy that file to
# Formula/betterbugs.rb in the tap repository:
#   brew install betterbugs/tap/betterbugs
class Betterbugs < Formula
  desc "BetterBugs CLI: read, file and act on bug reports from the terminal and CI"
  homepage "https://betterbugs.io"
  url "https://registry.npmjs.org/@betterbugs/cli/-/cli-__VERSION__.tgz"
  sha256 "__SHA256__"
  license "MIT"

  depends_on "node"
  depends_on "ffmpeg" => :recommended

  def install
    system "npm", "install", *std_npm_args
    bin.install_symlink Dir["#{libexec}/bin/*"]
  end

  test do
    assert_match version.to_s, shell_output("#{bin}/betterbugs --version")
    assert_match version.to_s, shell_output("#{bin}/bbug --version")
    assert_match "betterbugs", shell_output("#{bin}/betterbugs agent-context --json")
  end
end
