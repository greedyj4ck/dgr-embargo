Hooks.on("init", () => {
  game.settings.register("dgr-embargo", "initialized", {
    name: "Initialization",
    scope: "world",
    config: false,
    default: false,
    type: Boolean,
  });

  game.settings.registerMenu("dgr-embargo", "init-dialog", {
    name: "DGR Embargo Initialization",
    label: "Initialize",
    hint: "This will import the content from the Degenesis Embargo Adventure Module",
    type: DGREmbargoInitWrapper,
    restricted: true,
  });
});

Hooks.on("ready", () => {
  if (!game.settings.get("dgr-embargo", "initialized") && game.user.isGM) {
    new DGREmbargoInitialization().render(true);
  }
});

class DGREmbargoInitWrapper extends FormApplication {
  render() {
    new DGREmbargoInitialization().render(true);
  }
}

class DGREmbargoInitialization extends Dialog {
  constructor() {
    super({
      title: "Degenesis Rebirth Embargo Initialization",
      content: `<p class="notes">Initialize DGR Embargo Module?<br><br>This will import all Actors, Items, Journals, and Scenes into your world, sort them into folders, and place map pins</p>
            <ul>
            <li>X Actors</li>
            <li>Y Journal Entries</li>
            <li>Z Items</li>
            <li>A Scenes</li>
            <li>B Folders organizing the above</li>
            </ul>
            `,

      buttons: {
        initialize: {
          label: "Initialize",
          callback: async () => {
            game.settings.set("dgr-embargo", "initialized", true);
            await new DGREmbargoInitialization().initialize();
            ui.notifications.notify("Initialization Complete");
          },
        },
        no: {
          label: "No",
          callback: () => {
            game.settings.set("dgr-embargo", "initialized", true);
            ui.notifications.notify("Skipped Initialization.");
          },
        },
      },
    });

    this.folders = {
      Scene: {},
      Item: {},
      Actor: {},
      JournalEntry: {},
    };
    this.SceneFolders = {};
    this.ActorFolders = {};
    this.ItemFolders = {};
    this.JournalEntryFolders = {};
    this.journals = {};
    this.actors = {};
    this.scenes = {};
    this.moduleKey = "dgr-embargo";
  }

  async initialize() {
    return new Promise((resolve) => {
      fetch(`modules/${this.moduleKey}/initialization.json`)
        .then(async (r) => r.json())
        .then(async (json) => {
          let createdFolders = await Folder.create(json);
          for (let folder of createdFolders)
            this.folders[folder.data.type][folder.data.name] = folder;

          for (let folderType in this.folders) {
            for (let folder in this.folders[folderType]) {
              let parent = this.folders[folderType][folder].getFlag(
                this.moduleKey,
                "initialization-parent"
              );
              if (parent) {
                let parentId = this.folders[folderType][parent].data._id;
                await this.folders[folderType][folder].update({
                  parent: parentId,
                });
              }
            }
          }

          await this.initializeEntities();
          await this.initializeScenes();
          await this.initializeActors();
          resolve();
        });
    });
  }

  async initializeEntities() {
    let journalPack = `${this.moduleKey}.dgr-embargo-journals`;
    let journalPackContent = await game.packs.get(journalPack).getContent();

    journalPackContent.forEach((entity) => {
      let entityObject = entity.toObject();

      if (entityObject.name.includes("(S)"))
        entityObject.folder = game.folders.find(
          (folder) => folder.name === "SCENES"
        ).id;
      if (entityObject.name.includes("(H)"))
        entityObject.folder = game.folders.find(
          (folder) => folder.name === "HANDOUTS"
        ).id;
      if (entityObject.name.includes("(C)"))
        entityObject.folder = game.folders.find(
          (folder) => folder.name === "CHARACTERS"
        ).id;

      // Now create that entry
      JournalEntry.create(entityObject);
    });

    // Initialise other entities (items, actors) here
  }

  // Init scenes here
  async initializeScenes() {
    let scenesPack = `${this.moduleKey}.dgr-embargo-scenes`;
    let scenesPackContent = await game.packs.get(scenesPack).getContent();

    console.log(scenesPackContent);

    scenesPackContent.forEach((entity) => {
      let entityObject = entity.toObject();

      if (entityObject.name.includes("(I)"))
        entityObject.folder = game.folders.find(
          (folder) => folder.name === "EMBARGO SCENES"
        ).id;
      if (entityObject.name.includes("(ML)"))
        entityObject.folder = game.folders.find(
          (folder) => folder.name === "MAPS (LABELS)"
        ).id;
      if (entityObject.name.includes("(M)"))
        entityObject.folder = game.folders.find(
          (folder) => folder.name === "MAPS (NO LABELS)"
        ).id;

      console.log(`Creating Scene ${entityObject.name}`);
      // Now create that scene and the thumbnail
      Scene.create(entityObject).then(async (scene) => {
        let thumb = await scene.createThumbnail();
        scene.update({ thumb: thumb.thumb });
      });
    });
  }

  // Init actors here
  async initializeActors() {
    let actorsPack = `${this.moduleKey}.dgr-embargo-actors`;
    let actorsPackContent = await game.packs.get(actorsPack).getContent();

    console.log(actorsPackContent);

    actorsPackContent.forEach((entity) => {
      let entityObject = entity.toObject();

      entityObject.folder = game.folders.find(
        (folder) => folder.name === "EMBARGO CHARACTERS"
      ).id;

      console.log(`Creating Actor ${entityObject.name}`);

      Actor.create(entityObject);
    });
  }
}
