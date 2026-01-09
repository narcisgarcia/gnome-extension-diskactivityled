import Adw from 'gi://Adw';
import Gtk from 'gi://Gtk';
import Gdk from 'gi://Gdk';
import { ExtensionPreferences } from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

export default class DiskActivityLEDPreferences extends ExtensionPreferences {
    fillPreferencesWindow(window) {
        const settings = this.getSettings();
        
        const page = new Adw.PreferencesPage();
        const group = new Adw.PreferencesGroup({
            title: 'LED Settings',
        });
        
        // Read LED color
        const readColorRow = new Adw.ActionRow({
            title: 'Read LED Color',
            subtitle: 'Color for disk read activity'
        });
        const readColorButton = new Gtk.ColorButton();
        const readColor = new Gdk.RGBA();
        readColor.parse(settings.get_string('read-color'));
        readColorButton.set_rgba(readColor);
        readColorButton.connect('color-set', () => {
            settings.set_string('read-color', readColorButton.get_rgba().to_string());
        });
        readColorRow.add_suffix(readColorButton);
        
        // Write LED color
        const writeColorRow = new Adw.ActionRow({
            title: 'Write LED Color',
            subtitle: 'Color for disk write activity'
        });
        const writeColorButton = new Gtk.ColorButton();
        const writeColor = new Gdk.RGBA();
        writeColor.parse(settings.get_string('write-color'));
        writeColorButton.set_rgba(writeColor);
        writeColorButton.connect('color-set', () => {
            settings.set_string('write-color', writeColorButton.get_rgba().to_string());
        });
        writeColorRow.add_suffix(writeColorButton);
        
        // Font size
        const fontSizeRow = new Adw.ActionRow({
            title: 'Font Size',
            subtitle: 'Size of the speed text'
        });
        const fontSizeSpinButton = new Gtk.SpinButton({
            adjustment: new Gtk.Adjustment({
                lower: 0.5,
                upper: 3.0,
                step_increment: 0.1,
                page_increment: 0.5,
                value: settings.get_double('font-size')
            }),
            digits: 1
        });
        fontSizeSpinButton.connect('value-changed', () => {
            settings.set_double('font-size', fontSizeSpinButton.get_value());
        });
        fontSizeRow.add_suffix(fontSizeSpinButton);
        
        // LED threshold
        const thresholdRow = new Adw.ActionRow({
            title: 'LED Threshold',
            subtitle: 'Minimum bytes/s to activate LEDs'
        });
        const thresholdSpinButton = new Gtk.SpinButton({
            adjustment: new Gtk.Adjustment({
                lower: 100,
                upper: 100000,
                step_increment: 100,
                page_increment: 1000,
                value: settings.get_int('led-threshold')
            }),
            digits: 0
        });
        thresholdSpinButton.connect('value-changed', () => {
            settings.set_int('led-threshold', thresholdSpinButton.get_value());
        });
        thresholdRow.add_suffix(thresholdSpinButton);
        
        group.add(readColorRow);
        group.add(writeColorRow);
        group.add(fontSizeRow);
        group.add(thresholdRow);
        page.add(group);
        window.add(page);
    }
}
