fn main() {
    // sqlx::migrate! embeds the migrations at compile time; without this a
    // newly added migration file would not trigger a rebuild.
    println!("cargo:rerun-if-changed=migrations");
    // generate_context! embeds the window/app icons, but only regenerates when
    // the crate recompiles - rerunning the build script on icon changes forces that.
    println!("cargo:rerun-if-changed=icons");
    tauri_build::build()
}
