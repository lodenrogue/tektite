cask "tektite" do
  version "0.1.4"
  sha256 :no_check

  url "https://github.com/mathiasconradt/tektite/releases/download/v#{version}/Tektite-macOS-arm64.zip"
  name "Tektite"
  desc "Local-first Markdown knowledge base desktop app"
  homepage "https://github.com/mathiasconradt/tektite"

  depends_on arch: :arm64
  depends_on macos: :big_sur

  app "Tektite.app"

  preflight do
    system_command "/usr/bin/xattr",
                   args: ["-cr", "#{staged_path}/Tektite.app"],
                   sudo: false
  end

  zap trash: [
    "~/Library/Application Support/Tektite",
    "~/Library/Preferences/com.electron.tektite.plist",
    "~/Library/Saved Application State/com.electron.tektite.savedState",
  ]
end
