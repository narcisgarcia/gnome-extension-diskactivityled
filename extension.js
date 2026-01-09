import { default as Clutter } from 'gi://Clutter';
import { default as St } from 'gi://St';
import { default as GObject } from 'gi://GObject';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';
import { default as Gio } from 'gi://Gio';
import GLib from 'gi://GLib';
import { Extension } from 'resource:///org/gnome/shell/extensions/extension.js';

const DiskActivityButton = GObject.registerClass(
class DiskActivityButton extends PanelMenu.Button {
    _init(settings, extension) {
        super._init(0.0, 'Disk Activity LED', false);
        
        this._settings = settings;
        this._extension = extension;
        this._refreshTime = 2.0;
        this._lastReadCount = 0;
        this._lastWriteCount = 0;
        
        // Add preferences menu item
        const prefsItem = new PopupMenu.PopupMenuItem('Preferences');
        prefsItem.connect('activate', () => {
            this._extension.openPreferences();
        });
        this.menu.addMenuItem(prefsItem);
        
        this._mode = this._settings.get_int('mode');
        
        this._layoutManager = new St.BoxLayout({
            vertical: false,
            style_class: 'diskactivityled-container'
        });

        this._ioSpeedStaticIcon = new St.Icon({
            style_class: 'system-status-icon',
            y_align: Clutter.ActorAlign.CENTER,
            gicon: Gio.icon_new_for_string('drive-harddisk-symbolic')
        });

        let ledContainer = new St.BoxLayout({
            vertical: true,
            y_align: Clutter.ActorAlign.CENTER,
            style_class: 'diskactivityled-leds'
        });

        this._readLed = new St.Label({
            text: '',
            style_class: 'diskactivityled-rect'
        });

        this._writeLed = new St.Label({
            text: '',
            style_class: 'diskactivityled-rect'
        });

        ledContainer.add_child(this._readLed);
        ledContainer.add_child(this._writeLed);

        // Create vertical container for read/write speeds
        this._ioSpeedContainer = new St.BoxLayout({
            vertical: true,
            y_align: Clutter.ActorAlign.CENTER,
            style_class: 'diskactivityled-speed-container'
        });

        this._readSpeed = new St.Label({
            text: '↓ ---',
            y_align: Clutter.ActorAlign.CENTER,
            style_class: 'diskactivityled-speed-label'
        });

        this._writeSpeed = new St.Label({
            text: '↑ ---',
            y_align: Clutter.ActorAlign.CENTER,
            style_class: 'diskactivityled-speed-label'
        });

        this._ioSpeedContainer.add_child(this._readSpeed);
        this._ioSpeedContainer.add_child(this._writeSpeed);
        
        this._updateFontSize();

        this._layoutManager.add_child(this._ioSpeedStaticIcon);
        this._layoutManager.add_child(ledContainer);
        this._layoutManager.add_child(this._ioSpeedContainer);
        
        this.add_child(this._layoutManager);
        
        // Connect button click to change mode
        this.connect('button-press-event', (actor, event) => {
            if (event.get_button() === 1) {
                this._changeMode();
                return Clutter.EVENT_STOP;
            }
            return Clutter.EVENT_PROPAGATE;
        });
        
        // Listen for settings changes
        this._settingsChangedId = this._settings.connect('changed::font-size', () => this._updateFontSize());
        
        // Start the refresh timer
        this._timeout = GLib.timeout_add(
            GLib.PRIORITY_DEFAULT, 
            this._refreshTime * 1000, 
            () => {
                this._parseStat(true);
                return GLib.SOURCE_CONTINUE;
            }
        );
    }
    
    _changeMode() {
        this._mode++;
        if (this._mode > 7) {
            this._mode = 0;
        }
        this._settings.set_int('mode', this._mode);
        this._parseStat(true);
    }
    
    _parseStat(forceDot = false) {
        try {
            let input_file = Gio.file_new_for_path('/proc/diskstats');

            let [, contents, _etag] = input_file.load_contents(null);
            contents = new TextDecoder().decode(contents);
            let lines = contents.split('\n');

            let readCount = 0;
            let writeCount = 0;
            let line;

            for (let i = 0; i < lines.length; i++) {
                line = lines[i];
                let fields = line.split(/ +/);
                if (fields.length <= 2) break;

                if ((parseInt(fields[2]) % 16 === 0 || fields[3].match(/^(sd[a-z]|nvme\d+n\d+)$/))
                    && fields[3].indexOf('md') != 0
                    && fields[3].indexOf('ram') != 0
                    && fields[3].indexOf('dm-') != 0
                    && fields[3].indexOf('zram') != 0
                    && fields[3].indexOf('loop') != 0) {
                    readCount += parseInt(fields[4]);
                    writeCount += parseInt(fields[8]);
                }
            }

            if (this._lastReadCount === 0) this._lastReadCount = readCount;
            if (this._lastWriteCount === 0) this._lastWriteCount = writeCount;

            let readSpeed = (readCount - this._lastReadCount) / this._refreshTime * 512;
            let writeSpeed = (writeCount - this._lastWriteCount) / this._refreshTime * 512;
            let totalSpeed = readSpeed + writeSpeed;

            const readColor = this._settings.get_string('read-color');
            const writeColor = this._settings.get_string('write-color');
            const threshold = this._settings.get_int('led-threshold');
            
            this._readLed.style = readSpeed > threshold ? `background-color: ${readColor};` : 'background-color: transparent;';
            this._writeLed.style = writeSpeed > threshold ? `background-color: ${writeColor};` : 'background-color: transparent;';

            if (this._mode == 2 || this._mode == 3 || this._mode == 6 || this._mode == 7) {
                this._ioSpeedContainer.hide();
            } else {
                this._ioSpeedContainer.show();
            }
            if (this._mode == 4 || this._mode == 5 || this._mode == 6 || this._mode == 7) {
                this._ioSpeedStaticIcon.hide();
            } else {
                this._ioSpeedStaticIcon.show();
            }

            this._readSpeed.set_text('↓ ' + this._speedToString(readSpeed));
            this._writeSpeed.set_text('↑ ' + this._speedToString(writeSpeed));

            this._lastReadCount = readCount;
            this._lastWriteCount = writeCount;
        } catch (e) {
            this._readSpeed.set_text('↓ ' + e.message);
            this._writeSpeed.set_text('↑ ---');
        }

        return true;
    }
    
    _speedToString(amount) {
        let digits;
        let speed_map;
        speed_map = ["B/s", "K/s", "M/s", "G/s"];

        if (amount === 0)
            return "0" + speed_map[0];

        let unit = 0;
        while (amount >= 1000) {
            amount /= 1000;
            ++unit;
        }

        if (amount >= 100)
            digits = 0;
        else if (amount >= 10)
            digits = 1;
        else
            digits = 2;
        return String(amount.toFixed(digits)) + speed_map[unit];
    }
    
    _updateFontSize() {
        const fontSize = this._settings.get_double('font-size');
        this._readSpeed.style = `font-size: ${fontSize}em;`;
        this._writeSpeed.style = `font-size: ${fontSize}em;`;
    }
    
    destroy() {
        if (this._timeout) {
            GLib.source_remove(this._timeout);
            this._timeout = null;
        }
        if (this._settingsChangedId) {
            this._settings.disconnect(this._settingsChangedId);
            this._settingsChangedId = null;
        }
        super.destroy();
    }
});

export default class DiskActivityLEDExtension extends Extension {
    button = null;

    openPreferences() {
        try {
            super.openPreferences();
        } catch (e) {
            // Fallback to manual command if super method fails
            try {
                const proc = Gio.Subprocess.new(
                    ['gnome-extensions', 'prefs', this.metadata.uuid],
                    Gio.SubprocessFlags.NONE
                );
            } catch (err) {
                logError(err, 'Failed to open preferences');
            }
        }
    }

    enable() {
        const settings = this.getSettings();
        this.button = new DiskActivityButton(settings, this);
        Main.panel.addToStatusArea(this.uuid, this.button);
    }

    disable() {
        if (this.button) {
            this.button.destroy();
            this.button = null;
        }
    }
}
