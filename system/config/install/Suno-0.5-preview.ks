# Suno 0.5 preview installer.
# Fedora 44's own installer, unchanged, installing Suno instead of Silverblue.
# Only the payload is declared here; every other choice (language, disk,
# account) is left to the person in the installer.
ostreesetup --nogpg --osname=fedora --remote=Suno --url=file:///run/install/repo/Suno-repo --ref=Suno/0.5/x86_64/desktop-preview
firewall --use-system-defaults
%post --erroronfail
cp /etc/skel/.bash* /root
# Suno always starts at its login screen, however the install was driven.
systemctl set-default graphical.target
%end
