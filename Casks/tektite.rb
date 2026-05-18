cask "tektite" do
  version "0.1.2"
  sha256 :no_check

  url "https://github.com/mathiasconradt/tektite/releases/download/v#{version}/Tektite-macOS-arm64.zip"
  name "Tektite"
  desc "Local-first Markdown knowledge base desktop app"
  homepage "https://github.com/mathiasconradt/tektite"

  depends_on arch: :arm64
  depends_on macos: :big_sur

  app "Tektite.app"

  zap trash: [
    "~/Library/Application Support/Tektite",
    "~/Library/Preferences/com.electron.tektite.plist",
    "~/Library/Saved Application State/com.electron.tektite.savedState",
  ]
end
