// Pas de fenêtre de console en plus sous Windows.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    kollab_lib::run()
}
