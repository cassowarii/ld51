"use strict";

window.requestAnimFrame = (function() {
    return window.requestAnimationFrame      ||
        window.webkitRequestAnimationFrame   ||
        window.mozRequestAnimationFrame      ||
        window.oRequestAnimationFrame        ||
        window.msRequestAnimationFrame       ||
        function(callback, element) {
            window.setTimeout(callback, 1000/60);
        };
})();

let CANVAS_WIDTH = 800;
let CANVAS_HEIGHT = 600;

let audiocheck = document.createElement('audio');

let titlebgm;
let bgm;
let rbgm;

let sfx = {
    bloop: new Audio('sfx/bloop.wav'),
    bloop_r: new Audio('sfx/bloop-reverse.wav'),
};
sfx.bloop.volume = 0.05;
sfx.bloop_r.volume = 0.05;

function playSfx(name) {
    if (!muted) {
        sfx[name].currentTime = 0;
        sfx[name].play();
    }
}

function goodmod(x, n) {
     return ((x%n)+n)%n;
}

let ready_to_go = false;
let game_started = false;

let won = false;

let tiles_img;
let character_img;
let objs_img;
let timer_img;
let msg_img;
let nums_img;
let arrow_img;
let loading_img;
let clicktostart_img;
let title_img;

let bg_color = '20, 16, 19';

let tile_size = 8;
let draw_scale = 4;
let level_w = 20;
let level_h = 14;

let canvas_w = level_w * tile_size;
let canvas_h = (level_h + 1) * tile_size;

let level_number = 1;

let framestep = 1000/60;

let level_images = {
    title: new Image(),
    story: new Image(),
    1: new Image(),
    '1complete': new Image(),
    2: new Image(),
    3: new Image(),
    4: new Image(),
    5: new Image(),
    6: new Image(),
    12: new Image(),
    end: new Image(),
};

let canvas;
let global_ctx; /* context for the actual real canvas */
let mask_ctx;   /* context for drawing the transition mask, gets scaled up */
let copy_ctx;   /* context for copying the old screen on transition */
let draw_ctx;   /* context for drawing the real level */

let UIState = { INGAME: 0, TRANSITION: 1, TITLESCREEN: 2 };

let ui_state;

let message_state = 0;

let TransitionType = { DOTS: 1, SLIDE_DOWN: 2, SLIDE_UP: 3, FADE: 4, CIRCLE: 5 };

let DOT_TRANSITION_LENGTH = 800;
let TRANSITION_DOT_LENGTH = 300;
let SLIDE_TRANSITION_LENGTH = 400;
let FADE_TRANSITION_LENGTH = 600;
let FAST_FADE_TRANSITION_LENGTH = 100;
let CIRCLE_TRANSITION_LENGTH = 500;

let transition = {
    is_transitioning: false,
    timer: 0,
    color: '#000000',
    w: 20,
    h: 14,
    dir_invert_v: false,
    dir_invert_h: false,
    invert_shape: true,
    mid_long: false,
    done_func: null,
    goal_state: UIState.TITLESCREEN,
    type: TransitionType.DOTS,
    nodraw: false,
}

function long_transition(callback) {
    if (transition.is_transitioning) return;

    draw();

    transition.invert_shape = false;
    ui_state = UIState.TRANSITION;
    _internal_start_transition(function() {
        transition.mid_long = true;
    }, function() {
        transition.invert_shape = true;
        transition.is_transitioning = true;
        let tdiv = transition.dir_invert_v;
        let tdih = transition.dir_invert_h;
        _internal_start_transition(function() {
            transition.mid_long = false;
            callback();
            transition.dir_invert_v = tdiv;
            transition.dir_invert_h = tdih;
        });
    });
}

function start_transition(callback, on_done) {
    if (transition.is_transitioning) return;
    if (!transition.nodraw) draw();

    _internal_start_transition(callback, on_done);
}

function _internal_start_transition(callback, on_done) {
    if (on_done) {
        transition.done_func = on_done;
    }

    if (transition.type == TransitionType.DOTS) {
        transition.end_time = DOT_TRANSITION_LENGTH;
    } else if (transition.type == TransitionType.SLIDE_DOWN || transition.type == TransitionType.SLIDE_UP) {
        transition.end_time = SLIDE_TRANSITION_LENGTH;
    } else if (transition.type == TransitionType.FADE) {
        transition.end_time = FADE_TRANSITION_LENGTH;
    } else if (transition.type == TransitionType.FAST_FADE) {
        transition.end_time = FAST_FADE_TRANSITION_LENGTH;
    } else if (transition.type == TransitionType.CIRCLE) {
        transition.end_time = CIRCLE_TRANSITION_LENGTH;
    }

    copy_ctx.drawImage(draw_ctx.canvas, 0, 0);

    transition.dir_invert_v = Math.random() < 0.5;
    transition.dir_invert_h = Math.random() < 0.5;

    callback();

    if (ui_state != UIState.TRANSITION) {
        transition.goal_state = ui_state;
    }

    transition.is_transitioning = true;
    transition.timer = 0;
}

function finish_transition() {
    transition.is_transitioning = false;
    transition.timer = 0;
    ui_state = transition.goal_state;

    if (transition.done_func) {
        setTimeout(function() {
            transition.done_func();
            transition.done_func = null;
        }, 400);
    }
}

/* state:
 * STAND: waiting for input
 * MOVE: moving
 * WIN: won level
 */
let State = { STAND: 0, MOVE: 1, WIN: 2 };

let game_state = State.STAND;

let started = false;

let muted = false;

let save_data = 1;

function toggle_mute() {
    muted = !muted;
    if (muted) {
        bgm.pause();
    } else {
        bgm.play();
    }
    save_muted();
}

let total_things_to_load = 0;
let things_loaded = 0;

function register_resource() {
    total_things_to_load ++;
    console.log("Things to load:", total_things_to_load);
    return function() {
        if (!ready_to_go) {
            things_loaded ++;
            console.log("Things loaded:", things_loaded, "/", total_things_to_load);
            if (things_loaded >= total_things_to_load) {
                console.log("Ready");
                game_ready();
            }
        }
    }
}

function game_ready() {
    ready_to_go = true;
    if (clicktostart_img && clicktostart_img.complete) {
        global_ctx.save();
        global_ctx.scale(draw_scale, draw_scale);
        global_ctx.drawImage(clicktostart_img, 0, 0);
        global_ctx.restore();
    }
}

ready(function() {
    clicktostart_img = new Image();
    clicktostart_img.onload = function() {
        if (ready_to_go) {
            global_ctx.save();
            global_ctx.scale(draw_scale, draw_scale);
            global_ctx.drawImage(clicktostart_img, 0, 0);
            global_ctx.restore();
        }
    }
    clicktostart_img.src = 'clicktostart.png';

    canvas = document.getElementById('canvas');
    global_ctx = canvas.getContext('2d');
    global_ctx.imageSmoothingEnabled = false;
    global_ctx.webkitImageSmoothingEnabled = false;
    global_ctx.mozImageSmoothingEnabled = false;

    let mask_canvas = document.createElement('canvas');
    mask_ctx = mask_canvas.getContext('2d');
    mask_ctx.imageSmoothingEnabled = false;
    mask_ctx.webkitImageSmoothingEnabled = false;
    mask_ctx.mozImageSmoothingEnabled = false;

    let copy_canvas = document.createElement('canvas');
    copy_ctx = copy_canvas.getContext('2d');
    copy_ctx.imageSmoothingEnabled = false;
    copy_ctx.webkitImageSmoothingEnabled = false;
    copy_ctx.mozImageSmoothingEnabled = false;

    let draw_canvas = document.createElement('canvas');
    draw_ctx = draw_canvas.getContext('2d');
    draw_ctx.imageSmoothingEnabled = false;
    draw_ctx.webkitImageSmoothingEnabled = false;
    draw_ctx.mozImageSmoothingEnabled = false;

    loading_img = new Image();
    loading_img.onload = function() {
        if (!ready_to_go) {
            global_ctx.save();
            global_ctx.scale(draw_scale, draw_scale);
            global_ctx.drawImage(loading_img, 0, 0);
            global_ctx.restore();
        }
    }
    loading_img.src = 'loading.png';

    tiles_img = new Image();
    character_img = new Image();
    objs_img = new Image();
    timer_img = new Image();
    msg_img = new Image();
    nums_img = new Image();
    arrow_img = new Image();
    title_img = new Image();

    tiles_img.src = 'tile.png';
    character_img.src = 'truck.png';
    objs_img.src = 'objs.png';
    timer_img.src = 'timer.png';
    msg_img.src = 'bottom-messages.png';
    nums_img.src = 'numbers.png';
    arrow_img.src = 'arrow.png';
    title_img.src = 'title.png';

    ready_to_go = false;

    for (let num in level_images) {
        level_images[num].src = 'level-images/' + num + '.png';
    }

    if (audiocheck.canPlayType('audio/mpeg')) {
        titlebgm = new Audio();
        titlebgm.addEventListener('canplaythrough', register_resource(), false);
        titlebgm.src = 'music/titlescreen.mp3';

        bgm = new Audio();
        bgm.addEventListener('canplaythrough', register_resource(), false);
        bgm.src = 'music/game.mp3';

        rbgm = new Audio();
        rbgm.addEventListener('canplaythrough', register_resource(), false);
        rbgm.src = 'music/game-reverse.mp3';
    } else if (audiocheck.canPlayType('audio/ogg')) {
        titlebgm = new Audio();
        titlebgm.addEventListener('canplaythrough', register_resource(), false);
        titlebgm.src = 'music/titlescreen.ogg';

        bgm = new Audio();
        bgm.addEventListener('canplaythrough', register_resource(), false);
        bgm.src = 'music/game.ogg';

        rbgm = new Audio();
        rbgm.addEventListener('canplaythrough', register_resource(), false);
        rbgm.src = 'music/game-reverse.ogg';
    }

    bgm.volume = 0.5;
    rbgm.volume = 0.5;

    bgm.loop = true;
    rbgm.loop = true;
    titlebgm.loop = true;

    rbgm.load();

    ui_state = UIState.INGAME;

    save_data = localStorage.getItem("casso.renewmysubscription.save") || 1;

    draw_ctx.fillStyle = 'rgb(0, 0, 0)';
    draw_ctx.fillRect(0, 0, level_w * tile_size, level_h * tile_size);

    transition.nodraw = true;
    transition.type = TransitionType.FADE;
    transition.nodraw = false;

    //loop();
});

function delete_save() {
    localStorage.setItem("casso.renewmysubscription.save", 1);
}

function save() {
    if (!levels.hasOwnProperty(level_number + 1)) {
        localStorage.setItem("casso.renewmysubscription.save", 1);
    } else {
        localStorage.setItem("casso.renewmysubscription.save", level_number + 1);
    }
}

function initialize() {
    started = true;
    ui_state = UIState.INGAME;
}

let ID = {
    grass: 0,
    tuft: 1,
    flower: 2,
    road_top: 3,
    road: 4,
    fencel: 5,
    fencec: 6,
    fencer: 7,
    house: 8,
    water_top: 9,
    water: 10,
    start: 11,
    lrbridge: 12,
    rightoneway: 13,
    leftoneway: 14,
    uponeway: 15,
    downoneway: 16,
    secretrightoneway: 17,
    secretleftoneway: 18,
    secretuponeway: 19,
    secretdownoneway: 20,
    rightduallane: 21,
    secretrightduallane: 22,
    secretrightbridge: 32,
    secretleftbridge: 33,
    onewayrightbridge: 36,
    onewayleftbridge: 37,
    onewayrightnotop: 38,
    onewayleftnotop: 39,
    secretonewayrightnotop: 40,
    secretonewayleftnotop: 41,
};

let objID = {
    pastself: 0,
    negapastself: 1,
    checkmark: 2,
    star: 3,
    revstar: 4,
};

let passable = {
    [ID.road_top]: true,
    [ID.road]: true,
    [ID.start]: true,
    [ID.lrbridge]: true,
    [ID.rightoneway]: true,
    [ID.uponeway]: true,
    [ID.downoneway]: true,
    [ID.leftoneway]: true,
    [ID.secretrightoneway]: true,
    [ID.secretuponeway]: true,
    [ID.secretdownoneway]: true,
    [ID.secretleftoneway]: true,
    [ID.rightduallane]: true,
    [ID.secretrightduallane]: true,
    [ID.secretrightbridge]: true,
    [ID.secretleftbridge]: true,
    [ID.onewayrightbridge]: true,
    [ID.onewayleftbridge]: true,
    [ID.onewayrightnotop]: true,
    [ID.onewayleftnotop]: true,
    [ID.secretonewayrightnotop]: true,
    [ID.secretonewayleftnotop]: true,
}

let isgoal = {
    [ID.house]: true,
}

let blocksleft = {
    [ID.rightoneway]: true,
    [ID.secretrightoneway]: true,
    [ID.rightduallane]: true,
    [ID.secretrightduallane]: true,
    [ID.secretrightbridge]: true,
    [ID.onewayrightbridge]: true,
    [ID.onewayrightnotop]: true,
    [ID.secretonewayrightnotop]: true,
}

let blocksright = {
    [ID.leftoneway]: true,
    [ID.secretleftoneway]: true,
    [ID.secretleftbridge]: true,
    [ID.onewayleftbridge]: true,
    [ID.onewayleftnotop]: true,
    [ID.secretonewayleftnotop]: true,
}

let blocksup = {
    [ID.downoneway]: true,
    [ID.secretdownoneway]: true,
}

let blocksdown = {
    [ID.uponeway]: true,
    [ID.secretuponeway]: true,
}

let reversed = false;

let keep_going = true;
let last_frame_time;
let timedelta = 0;
function loop(timestamp) {
    if (timestamp == undefined) {
        timestamp = 0;
        last_frame_time = timestamp;
    }
    timedelta += timestamp - last_frame_time;
    last_frame_time = timestamp;

    while (timedelta >= framestep) {
        update(framestep);
        timedelta -= framestep;
    }
    draw();

    if (keep_going) {
        requestAnimFrame(loop);
    }
}

function undo() {
    if (won_level) return;

    console.log('undo');
    if (undo_stack.length > 0) {
        let prev_reversed = reversed;

        let undo_entry = undo_stack.pop();
        if (!reversed) {
            character.x = undo_entry.x;
            character.y = undo_entry.y;
            character.target_x = undo_entry.x;
            character.target_y = undo_entry.y;
        } else {
            character.x = undo_entry.tx;
            character.y = undo_entry.ty;
            character.target_x = undo_entry.tx;
            character.target_y = undo_entry.ty;
        }
        character.direction = undo_entry.dir;
        current_timestep = undo_entry.time;
        reversed = undo_entry.reversed;
        last_negaself = undo_entry.last_negaself;
        ndelivered = undo_entry.ndelivered;
        tile_frame = undo_entry.tile_frame;

        character.move_fraction = 0;
        game_state = State.STAND;
        for (let i = 0; i < 10; i++) {
            objs[i] = [];
            for (let o of undo_entry.objs[i]) {
                let new_obj = {
                    id: o.id,
                    x: o.x,
                    y: o.y,
                };
                if (o.hasOwnProperty('alpha')) {
                    new_obj.alpha = o.alpha;
                }
                if (o.hasOwnProperty('just_reversed')) {
                    new_obj.just_reversed = o.just_reversed;
                }
                if (o.hasOwnProperty('direction')) {
                    new_obj.direction = o.direction;
                }
                if (o.hasOwnProperty('frame')) {
                    new_obj.frame = o.frame;
                }
                if (o.hasOwnProperty('target_x')) {
                    new_obj.target_x = o.target_x;
                }
                if (o.hasOwnProperty('target_y')) {
                    new_obj.target_y = o.target_y;
                }
                if (o.hasOwnProperty('play_sound')) {
                    new_obj.play_sound = o.play_sound;
                }
                objs[i].push(new_obj);
            }
        }

        completing_level = false;
        paradox = false;
        paradox_state = false;
        character.halfway_collide = false;
        won_level = false;

        if (!prev_reversed && reversed) {
            rbgm.currentTime = bgm.duration - bgm.currentTime;
            rbgm.play();
            bgm.pause();
        }
        if (prev_reversed && !reversed) {
            rbgm.pause();
            bgm.currentTime = rbgm.duration - rbgm.currentTime;
            bgm.play();
        }
    }
}

function save_undo_state(dir, frame, is_reverse_undo) {
    if (paradox) return;

    let undo_entry = {
        x: character.x,
        y: character.y,
        tx: character.target_x,
        ty: character.target_y,
        dir: dir,
        tile_frame: frame,
        time: reversed && !is_reverse_undo ? current_timestep + 1 : current_timestep,
        reversed: reversed,
        last_negaself: last_negaself,
        ndelivered: ndelivered,
        objs: new Array(10),
    }

    for (let i = 0; i < 10; i++) {
        undo_entry.objs[i] = [];
        for (let o of objs[i]) {
            let new_obj = {
                id: o.id,
                x: o.x,
                y: o.y,
            };
            if (o.hasOwnProperty('alpha')) {
                new_obj.alpha = o.alpha;
            }
            if (o.hasOwnProperty('just_reversed')) {
                new_obj.just_reversed = o.just_reversed;
            }
            if (o.hasOwnProperty('direction')) {
                new_obj.direction = o.direction;
            }
            if (o.hasOwnProperty('frame')) {
                new_obj.frame = o.frame;
            }
            if (o.hasOwnProperty('target_x')) {
                new_obj.target_x = o.target_x;
            }
            if (o.hasOwnProperty('target_y')) {
                new_obj.target_y = o.target_y;
            }
            if (o.hasOwnProperty('play_sound')) {
                new_obj.play_sound = o.play_sound;
            }
            undo_entry.objs[i].push(new_obj);
        }
    }

    undo_stack.push(undo_entry);
}

function reverse() {
    if (game_state == State.STAND && !paradox) {
        transition.type = TransitionType.CIRCLE;
        start_transition(function() {
            save_undo_state(character.direction, tile_frame, true);
            reversed = !reversed;
            if (!reversed) {
                character.target_x = character.x;
                character.target_y = character.y;
                rbgm.pause();
                bgm.currentTime = rbgm.duration - rbgm.currentTime;
                bgm.play();
            } else {
                character.x = character.target_x;
                character.y = character.target_y;
                bgm.pause();
                rbgm.currentTime = bgm.duration - bgm.currentTime;
                rbgm.play();
            }
            check_victory();
        });
    }
}

document.onmousedown = function() {
    if (first_few_pages()) {
        return;
    }

    if (won_level) {
        next_level();
        return;
    }

}

function first_few_pages() {
    if (ready_to_go && !game_started) {
        game_started = true;
        console.log("hi");
        level_number = 'title';
        load_level();
        titlebgm.play();
        loop();
        return true;
    } else if (level_number === 'title') {
        level_number = 'story';
        load_level();
        return true;
    } else if (level_number === 'story') {
        begin_game();
        return true;
    } else {
        return false;
    }
}

function begin_game() {
    loop();
    transition.nodraw = true;
    transition.type = TransitionType.FADE;
    long_transition(function() {
        console.log("um hi");
        level_number = save_data;
        load_level();
        ui_state = UIState.INGAME;
        titlebgm.pause();
        bgm.play();
    });
    transition.nodraw = false;
}

let keys_down = {
    left:   false,
    right:  false,
    up:     false,
    down:   false,
};

let shift_down = false;
let save_deleted = false;

document.onkeydown = function(e) {
    if (transition.is_transitioning || ui_state == UIState.TRANSITION) return;

    if (won_level) {
        return;
    }

    if (level_number !== 'title' && level_number !== 'story') {
        if (e.keyCode == 16) {
            shift_down = true;
        } else if (e.keyCode == 88 && shift_down) {
            save_deleted = true;
            delete_save();
        }
    }

    if (e.keyCode >= 37 && e.keyCode <= 40 || e.keyCode == 190) {
        switch (e.keyCode) {
            case 37:
                keys_down.left = true;
                break;
            case 38:
                keys_down.up = true;
                break;
            case 39:
                keys_down.right = true;
                break;
            case 40:
                keys_down.down = true;
                break;
            case 190:
                keys_down.dot = true;
                break;
        }
        e.preventDefault();
    }

    if (e.keyCode == 90 || e.keyCode == 27 || e.keyCode == 82 || e.keyCode == 77 || e.keyCode == 190) {
        e.preventDefault();
    }
}

document.onkeyup = function(e) {
    if (first_few_pages()) {
        /* We advanced one of the opening pages */
        return;
    }

    if (e.keyCode == 16) {
        shift_down = false;
        save_deleted = false;
    }

    if (e.keyCode == 37 && keys_down.left) {
        keys_down.left = false;
        return;
    }
    if (e.keyCode == 38 && keys_down.up) {
        keys_down.up = false;
        return;
    }
    if (e.keyCode == 39 && keys_down.right) {
        keys_down.right = false;
        return;
    }
    if (e.keyCode == 40 && keys_down.down) {
        keys_down.down = false;
        return;
    }
    if (e.keyCode == 190 && keys_down.dot) {
        keys_down.dot = false;
        return;
    }

    if (transition.is_transitioning || ui_state == UIState.TRANSITION) return;

    if (e.keyCode == 82) {
        /* R */
        if (ui_state == UIState.INGAME) {
            transition.type = TransitionType.FADE;
            start_transition(reset);
        }
        return;
    }

    if (won_level) {
        next_level();
        return;
    }

    if (e.keyCode == 90) {
        /* Z */
        if (ui_state == UIState.INGAME) {
            transition.type = TransitionType.FAST_FADE;
            start_transition(undo);
        }
    }

    /*if (e.keyCode == 27) {
        if (ui_state == UIState.INGAME) {
            transition.type = TransitionType.DOTS;
            long_transition(return_to_map);
        }
    }*/

    if (e.keyCode == 32) {
        /* Space */
        if (ui_state == UIState.INGAME) {
            reverse();
        }
    }

    if (e.keyCode == 77) {
        toggle_mute();
        save_mute();
    }
}

function tile_at(x, y) {
    /* in this game, the outside is impassable/indestructible */
    if (x < 0 || x >= level_w || y < 0 || y >= level_h) {
        return 0;
    }
    return level.map[y * level_w + x];
}

let reversed_on_last_move = false;
let reversed_on_2xlast_move = false;

function do_move(dx, dy) {
    if (ui_state === UIState.TRANSITION) {
        return false;
    }

    if (current_timestep == 9 && !reversed) {
        /* Can't move past 10 seconds */
        return false;
    }

    if (current_timestep == 0 && reversed) {
        /* Also can't reverse past 0 seconds */
        return false;
    }

    if (paradox) {
        /* Also can't move if we caused a time paradox */
        return false;
    }

    character.target_x = character.x + dx;
    character.target_y = character.y + dy;

    if (!passable[tile_at(character.target_x, character.target_y)]) {
        character.target_x = character.x;
        character.target_y = character.y;
        return false;
    }

    if ((!reversed && dx > 0 || reversed && dx < 0)
            && (blocksright[tile_at(character.target_x, character.target_y)]
                || blocksright[tile_at(character.x, character.y)])) {
        character.target_x = character.x;
        character.target_y = character.y;
        return false;
    }

    if ((!reversed && dx < 0 || reversed && dx > 0)
            && (blocksleft[tile_at(character.target_x, character.target_y)]
                || blocksleft[tile_at(character.x, character.y)])) {
        character.target_x = character.x;
        character.target_y = character.y;
        return false;
    }

    if ((!reversed && dy > 0 || reversed && dy < 0)
            && (blocksdown[tile_at(character.target_x, character.target_y)]
                || blocksdown[tile_at(character.x, character.y)])) {
        character.target_x = character.x;
        character.target_y = character.y;
        return false;
    }

    if ((!reversed && dy < 0 || reversed && dy > 0)
            && (blocksup[tile_at(character.target_x, character.target_y)]
                || blocksup[tile_at(character.x, character.y)])) {
        character.target_x = character.x;
        character.target_y = character.y;
        return false;
    }

    if (dx === 0 && dy === 0
            && (blocksup[tile_at(character.x, character.y)]
                || blocksdown[tile_at(character.x, character.y)]
                || blocksright[tile_at(character.x, character.y)]
                || blocksleft[tile_at(character.x, character.y)])) {
        /* Can't do a 'wait' on a one-way tile */
        character.target_x = character.x;
        character.target_y = character.y;
        return false;
    }

    if (dx > 0) {
        character.direction = 'right';
    } else if (dx < 0) {
        character.direction = 'left';
    } else if (dy > 0) {
        character.direction = 'down';
    } else if (dy < 0) {
        character.direction = 'up';
    }

    if (reversed) {
        [character.x, character.target_x] = [character.target_x, character.x];
        [character.y, character.target_y] = [character.target_y, character.y];
    }

    if (!reversed) {
        tile_frame ++;
    } else {
        tile_frame --;
    }
    tile_frame = goodmod(tile_frame, TILE_ANIM_NFRAMES);

    reversed_on_last_move = reversed;

    return true;
}

/*function swap_bgm(new_bgm) {
    bgm.pause();
    bgm = new_bgm;
    //bgm.currentTime = 0;
    if (!muted) {
        bgm.play();
    }
}*/

function reset() {
    let prev_reversed = reversed;

    load_level();
    game_state = State.STAND;

    if (prev_reversed && !reversed) {
        rbgm.pause();
        bgm.currentTime = rbgm.duration - rbgm.currentTime;
        bgm.play();
    }
}

function load_level() {
    if (level_number > levels.length) {
        win();
    } else {
        load_level_data(levels[level_number]);
    }
}

let level = {};

let objs = [];

let current_timestep = 0;

let undo_stack = [];

let ndelivered = 0;

let last_negaself = null;

let paradox = false;
let paradox_timer = 0;
let paradox_state = false;
let PARADOX_ANIM_SPEED = 200;

function load_level_data(lvl) {
    let charPos = lvl.map.indexOf(ID.start);
    character.x = charPos % level_w;
    character.y = Math.floor(charPos / level_w);

    character.target_x = character.x;
    character.target_y = character.y;

    level.ngoals = 0;
    ndelivered = 0;
    completing_level = false;

    paradox = false;
    paradox_state = false;
    character.halfway_collide = false;

    last_negaself = null;

    game_state = State.STAND;
    undo_stack = [];
    won_level = false;

    keys_down = { left: false, right: false, up: false, down: false, dot: false };
    character.move_fraction = 0;
    frame_ten_timer = 0;

    character.direction = 'right';

    level.map = [];

    current_timestep = 0;
    reversed = false;
    objs = new Array(10);
    for (let i = 0; i < objs.length; i++) {
        objs[i] = [];
    }

    for (let i = 0; i < lvl.map.length; i++) {
        level.map.push(lvl.map[i]);
    }

    for (let y = 0; y < level_h; y++) {
        for (let x = 0; x < level_w; x++) {
            if (isgoal[tile_at(x, y)]) {
                level.ngoals ++;
            }
        }
    }
}

let obj_offsets = {
    w: 12,
    h: 12,
    offset_x: 2,
    offset_y: 4,
}

let char_offsets = {
    w: 12,
    h: 12,
    offset_x: 2,
    offset_y: 4,
}

let character = {
    x: 1,
    y: 7,
    target_x: 1,
    target_y: 7,
    move_fraction: 0,
    direction: 'right',
}

let won_level = false;
let won_game = false;

let completing_level = false;

function win() {
    for (let i = 0; i < 10; i++) {
        /* Get rid of the transparent checkmarks so that they
         * will appear properly in the replay */
        objs[i] = objs[i].filter(o => o.id != objID.checkmark || o.alpha != 0.5);
    }
    save();
    won_level = true;
    completing_level = false;
    objs[9].push({
        id: objID.pastself,
        x: character.x,
        y: character.y,
        target_x: character.x,
        target_y: character.y,
        direction: character.direction,
        just_reversed: false,
    });
}

const CHARACTER_WALK_SPEED = 40;

function get_current_objs() {
    if (!reversed) {
        return objs[current_timestep];
    } else {
        return objs[current_timestep];
    }
}

function set_current_objs(value) {
    if (!reversed) {
        objs[current_timestep] = value;
    } else {
        objs[current_timestep] = value;
    }
}

function objs_at(x, y) {
    return get_current_objs().filter(o => x == o.x && y == o.y && !o.just_reversed);
}

function halfway_collisions(x, y, tx, ty) {
    return get_current_objs().filter(o => tx == o.x && ty == o.y && x == o.target_x && y == o.target_y);
}

function on_leave_tile() {
    if (won_level) return;

    let hc = halfway_collisions(character.x, character.y, character.target_x, character.target_y);
    if (hc.length > 0) {
        console.log("HALFWAY COLLISION");
        for (let obj of hc) {
            obj.halfway_collide = true;
            obj.paradoxical = true;
        }
        character.halfway_collide = true;
        return;
    }
}

function on_enter_tile() {
    if (isgoal[tile_at(character.x, character.y - 1)]) {
        if (objs_at(character.x, character.y - 1).filter(o => o.id == objID.checkmark).length == 0) {
            ndelivered ++;
            console.log("Delivered:", ndelivered, "/", level.ngoals);

            for (let i = current_timestep; i < 10; i++) {
                objs[i].push({
                    x: character.x,
                    y: character.y - 1,
                    id: objID.checkmark,
                    frame: 0,
                    play_sound: i === current_timestep,
                });
            }
            for (let i = 0; i < current_timestep; i++) {
                objs[i].push({
                    x: character.x,
                    y: character.y - 1,
                    id: objID.checkmark,
                    alpha: 0.5,
                    frame: 0,
                    play_sound: false,
                });
            }
        }
    }

    let objs_on_tile = objs_at(character.x, character.y);
    if (!won_level && objs_on_tile.length > 0) {
        for (let o of objs_on_tile) {
            o.paradoxical = true;
        }
        paradox = true;
        return;
    }
}

function check_victory() {
    if (level.ngoals === 0) return; /* Victory level */

    if (tile_at(character.x, character.y) === ID.start) {
        if (ndelivered === level.ngoals) {
            if (reversed) {
                reverse();
            }
            completing_level = true;
        }
    }
}

function complete_level() {
    console.log("OMG YOU WON THE LEVEL YOU ARE A CHAMPION");
}

function next_level() {
    console.log("next level");
    transition.type = TransitionType.CIRCLE;
    /*character.x = 10;
    character.y = 7.5;*/
    long_transition(function() {
        level_number ++;
        if (!levels.hasOwnProperty(level_number)) {
            level_number = 'end';
        }
        load_level();
    });
}

let tile_anim_timer = 0;
let tile_frame = 0;
let TILE_ANIM_SPEED = 200;
let TILE_ANIM_NFRAMES = 4;

let frame_ten_timer = 0;

function update(delta) {
    let seconds = delta / 1000;

    if (level_number === 'title' || level_number === 'story') {
        tile_anim_timer += delta;
        while (tile_anim_timer >= TILE_ANIM_SPEED) {
            tile_anim_timer -= TILE_ANIM_SPEED;
            if (!reversed) {
                tile_frame ++;
            } else {
                tile_frame --;
            }
            tile_frame = goodmod(tile_frame, TILE_ANIM_NFRAMES);
        }

        title_sine_offset += seconds * 50;
        title_sine_offset = goodmod(title_sine_offset, 30);
    }

    if (save_deleted) {
        message_state = 6;
    } else if (shift_down) {
        message_state = 5;
    } else if (won_level) {
        message_state = 3;
    } else if (paradox) {
        message_state = 2;
    } else if (completing_level) {
        message_state = 4;
    } else if (reversed) {
        message_state = 1;
    } else {
        message_state = 0;
    }

    if (paradox) {
        game_state = State.STAND;
        paradox_timer += delta;
        while (paradox_timer > PARADOX_ANIM_SPEED) {
            paradox_timer -= PARADOX_ANIM_SPEED;
            paradox_state = !paradox_state;
        }
    }

    while (tile_anim_timer > TILE_ANIM_SPEED) {
        tile_anim_timer -= TILE_ANIM_SPEED;
    }

    if (transition.is_transitioning) {
        transition.timer += delta;
        if (transition.timer > transition.end_time) {
            finish_transition();
        }
    }

    if (game_state == State.STAND) {
        let will_move_next = false;
        let dir_before_move = character.direction;
        let frame_before_move = tile_frame;
        reversed_on_2xlast_move = reversed_on_last_move;
        if (won_level) {
            /* play through the loop when we win the level. */
            if (current_timestep == 9) {
                if (frame_ten_timer == 0) {
                    tile_frame ++;
                    tile_frame = goodmod(tile_frame, TILE_ANIM_NFRAMES);
                }
                frame_ten_timer += CHARACTER_WALK_SPEED / tile_size * seconds;
                if (frame_ten_timer >= 1) {
                    frame_ten_timer = 0;
                    current_timestep = 0;
                }
            } else {
                will_move_next = do_move(0, 0);
            }
        } else if (completing_level && current_timestep < 9) {
            /* If we reach the end but aren't at the last timestep, skip to the end.
             * Same as pressing '.' */
            will_move_next = do_move(0, 0);
        } else if (completing_level && current_timestep == 9) {
            win();
        } else if (keys_down.left && !keys_down.right) {
            will_move_next = do_move(-1, 0);
        } else if (keys_down.right && !keys_down.left) {
            will_move_next = do_move(1, 0);
        } else if (keys_down.up && !keys_down.down) {
            will_move_next = do_move(0, -1);
        } else if (keys_down.down && !keys_down.up) {
            will_move_next = do_move(0, 1);
        } else if (!keys_down.right && !keys_down.left && !keys_down.up && !keys_down.down && keys_down.dot) {
            will_move_next = do_move(0, 0);
        }

        if (!will_move_next) {
            game_state = State.STAND;
        } else {
            game_state = State.MOVE;
            if (reversed) {
                /* Since the timestep advances at the *end* of the move when moving forward,
                 * it logically must decrease at the *beginning* of the move when moving backwards.
                 * Trust me it makes sense */
                current_timestep --;
                character.move_fraction = 1;
            }
            on_leave_tile();

            save_undo_state(dir_before_move, frame_before_move, false);
        }
    }

    if (game_state == State.MOVE) {
        if (!paradox) {
            if (!reversed) {
                character.move_fraction += CHARACTER_WALK_SPEED / tile_size * seconds;
            } else {
                character.move_fraction -= CHARACTER_WALK_SPEED / tile_size * seconds;
            }
            if (character.halfway_collide) {
                if (!reversed && character.move_fraction >= 0.5 || reversed && character.move_fraction <= 0.5) {
                    character.move_fraction = 0.5;
                    paradox = true;
                }
            }
            if (!reversed && character.move_fraction >= 1 || reversed && character.move_fraction <= 0) {
                if (!reversed) {
                    if (!paradox) {
                        if (!won_level) {
                            get_current_objs().push({
                                id: objID.pastself,
                                x: character.x,
                                y: character.y,
                                target_x: character.target_x,
                                target_y: character.target_y,
                                direction: character.direction,
                                just_reversed: last_negaself != null,
                            });
                        }
                    }

                    if (last_negaself) {
                        objs[current_timestep].push({
                            id: objID.star,
                            x: character.x,
                            y: character.y,
                            target_x: character.x,
                            target_y: character.y,
                            frame: 0,
                        });
                    }

                    current_timestep ++;

                    if (last_negaself) {
                        /* This means we are moving after coming out of
                         * a negative-time phase, so the last negative
                         * self we created (and the *next* *positive*
                         * self we create) should now disappear
                         * when it collides with the self we just
                         * created moving backwards. Uhh it doesn't make
                         * any sense help */
                        last_negaself.just_reversed = true;
                        last_negaself = null;
                    }

                    if (current_timestep === 9
                            && ndelivered === level.ngoals
                            && tile_at(character.x, character.y) === ID.start) {
                        complete_level();
                    }
                }
                let [orig_x, orig_tx, orig_y, orig_ty] = [character.x, character.target_x, character.y, character.target_y];

                if (!reversed) {
                    character.x = character.target_x;
                    character.y = character.target_y;
                    character.move_fraction = 0;
                } else {
                    character.target_x = character.x;
                    character.target_y = character.y;
                    character.move_fraction = 0;
                }
                game_state = State.STAND;
                on_enter_tile();

                if (get_current_objs().filter(o => o.id == objID.checkmark && o.play_sound).length > 0) {
                    console.log("sound");
                    if (!reversed) {
                        playSfx('bloop');
                    } else {
                        playSfx('bloop_r');
                    }
                }

                if (reversed) {
                    /* We do this after entering a tile, so we don't crash into the
                     * past self that we create here on our own tile. */
                    /* We also save the last nega-self that we create, so that if
                     * we reverse time after this move, we can mark that it should
                     * disappear at the end of its movement. */
                    last_negaself = {
                        id: objID.negapastself,
                        x: orig_x,
                        y: orig_y,
                        target_x: orig_tx,
                        target_y: orig_ty,
                        direction: character.direction,
                        just_reversed: false,
                    }
                    if (!paradox) {
                        get_current_objs().push(last_negaself);
                    }
                    if (!reversed_on_2xlast_move) {
                        console.log("Flip star need");
                        /* This means we reversed in time, so we need to add a star. */
                        objs[current_timestep + 1].push({
                            id: objID.star,
                            x: orig_tx,
                            y: orig_ty,
                            target_x: orig_tx,
                            target_y: orig_ty,
                            frame: 0,
                        });
                    }
                    /* We already went back in time at the *beginning* of the move, so we don't decrement current timestep here.*/
                }

                check_victory();
            }
        }
    }
}

let NUMBER_WIDTH = 6;
let NUMBER_HEIGHT = 8;

function draw_levelnum(ctx) {
    if (level_number < 10) {
        if (level_number === 1) {
            ctx.drawImage(nums_img,
                0, NUMBER_HEIGHT * level_number, NUMBER_WIDTH, NUMBER_HEIGHT,
                1, 2, NUMBER_WIDTH, NUMBER_HEIGHT);
        } else {
            ctx.drawImage(nums_img,
                0, NUMBER_HEIGHT * level_number, NUMBER_WIDTH, NUMBER_HEIGHT,
                2, 2, NUMBER_WIDTH, NUMBER_HEIGHT);
        }
    } else {
        let first_digit = Math.floor(level_number / 10);
        let second_digit = level_number % 10;
        let xoffset = 1;
        let second_offset = 0;
        if (first_digit === 1) {
            xoffset = 0;
        }
        if (second_digit === 1) {
            second_offset = -1;
        }

        ctx.drawImage(nums_img,
            0, NUMBER_HEIGHT * first_digit, NUMBER_WIDTH, NUMBER_HEIGHT,
            xoffset + 1, 2, NUMBER_WIDTH, NUMBER_HEIGHT);
        ctx.drawImage(nums_img,
            0, NUMBER_HEIGHT * second_digit, NUMBER_WIDTH, NUMBER_HEIGHT,
            NUMBER_WIDTH + xoffset + second_offset, 2, NUMBER_WIDTH, NUMBER_HEIGHT);
    }
}

function draw_levelimg(ctx) {
    if (won_level && level_images[level_number + 'complete']) {
        ctx.drawImage(level_images[level_number + 'complete'], 0, 0);
    } else if (level_images[level_number]) {
        ctx.drawImage(level_images[level_number], 0, 0);
    }
}

function draw_arrow(ctx) {
    if (won_level) return;

    let mf = character.move_fraction;
    let x = character.x;
    let y = character.y;
    let tx = character.target_x;
    let ty = character.target_y;

    ctx.drawImage(arrow_img,
        (x * (1 - mf) + tx * mf) * tile_size - char_offsets.offset_x + 2,
        (y * (1 - mf) + ty * mf) * tile_size - char_offsets.offset_y - 4);
}

let TITLE_LETTER_WIDTHS = [5, 4, 4, 4, 6, 3, 6, 4, 3, 5, 4, 4, 4, 4, 4, 2, 3, 4, 2, 4, 3];
let title_sine_offset = 0;

function draw_title(ctx) {
    let title_width = TITLE_LETTER_WIDTHS.reduce((a, b) => a + b);

    let base_x = Math.floor(canvas_w / 2 - title_width / 2);

    let offset = 0;

    for (let w of TITLE_LETTER_WIDTHS) {
        let y_offset = Math.sin(((offset + title_sine_offset) / 30) * 2 * Math.PI) * 2;
        ctx.drawImage(title_img, offset, 0, w, 9, base_x + offset, 19 + y_offset, w, 9);
        offset += w;
    }
}

function draw() {
    let ctx = draw_ctx;

    ctx.save();

    ctx.fillStyle = 'rgb(' + bg_color + ')';

    ctx.beginPath();
    ctx.rect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    ctx.fill();

    draw_level(ctx);

    draw_levelimg(ctx);
    if (level_number === 'title') {
        draw_title(ctx);
    } else if (level_number === 'story') {
        /* uh... don't do anything? */
    } else {
        draw_objs(ctx);

        if (level_number !== 'end') {
            draw_timer(ctx);
        }

        if (level_number !== 'end' || shift_down) {
            draw_message(ctx);
        }

        draw_levelnum(ctx);

        draw_arrow(ctx);
    }

    draw_character(ctx);

    if (reversed) {
        ctx.save();
        ctx.globalCompositeOperation='difference';
        ctx.fillStyle='white';
        ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
        ctx.restore();
    }

    if (transition.mid_long) {
        ctx.fillStyle = transition.color;
        ctx.fillRect(-1, -1, canvas_w + 5, canvas_h + 5);
    }

    ctx.restore();

    global_ctx.fillStyle = 'rgb(0, 0, 0)';
    global_ctx.beginPath();
    global_ctx.rect(0, 0, canvas_w * draw_scale, canvas_h * draw_scale);
    global_ctx.fill();

    global_ctx.save();

    global_ctx.scale(draw_scale, draw_scale);

    global_ctx.drawImage(ctx.canvas, 0, 0);

    /*if (!can_go) {
        global_ctx.drawImage(clickstart_img, 0, 0);
    }*/

    if (transition.is_transitioning) {
        global_ctx.save();

        if (transition.type == TransitionType.DOTS) {
            mask_ctx.clearRect(0, 0, canvas_w, canvas_h);
            draw_transition_dot_mask(mask_ctx);

            // Redraw to reduce antialiasing effects
            for (let i = 0; i < 5; i++) {
                mask_ctx.drawImage(mask_ctx.canvas, 0, 0);
            }

            mask_ctx.globalCompositeOperation = 'source-in';
            mask_ctx.drawImage(copy_ctx.canvas, 0, 0);
            mask_ctx.globalCompositeOperation = 'source-over';

            global_ctx.drawImage(mask_ctx.canvas, 0, 0);
        } else if (transition.type == TransitionType.SLIDE_DOWN) {
            let offset = transition.timer / SLIDE_TRANSITION_LENGTH * canvas_h;

            global_ctx.drawImage(copy_ctx.canvas, 0, -offset);
            global_ctx.drawImage(ctx.canvas, 0, canvas_h - offset);
        } else if (transition.type == TransitionType.SLIDE_UP) {
            let offset = transition.timer / SLIDE_TRANSITION_LENGTH * canvas_h;

            global_ctx.drawImage(copy_ctx.canvas, 0, offset);
            global_ctx.drawImage(ctx.canvas, 0, - canvas_h + offset);
        } else if (transition.type == TransitionType.FADE || transition.type == TransitionType.FAST_FADE) {
            let alpha = 0;
            if (transition.type == TransitionType.FADE) {
                alpha = 1 - transition.timer / FADE_TRANSITION_LENGTH;
            } else if (transition.type == TransitionType.FAST_FADE) {
                alpha = 1 - transition.timer / FAST_FADE_TRANSITION_LENGTH;
            }

            mask_ctx.clearRect(0, 0, canvas_w, canvas_h);
            mask_ctx.fillStyle = 'rgba(255,255,255,' + alpha + ')';
            mask_ctx.fillRect(0, 0, canvas_w, canvas_h);
            mask_ctx.globalCompositeOperation = 'source-in';
            mask_ctx.drawImage(copy_ctx.canvas, 0, 0);
            mask_ctx.globalCompositeOperation = 'source-over';

            global_ctx.drawImage(mask_ctx.canvas, 0, 0);
        } else if (transition.type == TransitionType.CIRCLE) {
            mask_ctx.clearRect(0, 0, canvas_w, canvas_h);

            let frac = transition.timer / CIRCLE_TRANSITION_LENGTH;
            if (!transition.invert_shape) {
                frac = 1 - frac;
            }
            frac = Math.pow(frac, 1.5);

            let cx = character.x + 0.5;
            let cy = character.y + 0.5;
            let lh = level_h + 1;
            let distances_to_corners = [
                Math.sqrt(Math.pow(cx * tile_size, 2) + Math.pow(cy * tile_size, 2)),
                Math.sqrt(Math.pow((level_w - cx) * tile_size, 2) + Math.pow(cy * tile_size, 2)),
                Math.sqrt(Math.pow(cx * tile_size, 2) + Math.pow((lh - cy) * tile_size, 2)),
                Math.sqrt(Math.pow((level_w - cx) * tile_size, 2) + Math.pow((lh - cy) * tile_size, 2)),
            ];
            let max_radius = Math.max(...distances_to_corners);
            let radius = frac * max_radius;

            mask_ctx.globalCompositeOperation = 'source-over';
            mask_ctx.drawImage(copy_ctx.canvas, 0, 0);

            mask_ctx.globalCompositeOperation = 'destination-out';
            mask_ctx.fillStyle = 'rgba(255,255,255)';
            mask_ctx.beginPath();
            if (!transition.invert_shape) {
                mask_ctx.rect(-5, -5, canvas_w + 5, canvas_h + 5);
            }
            mask_ctx.arc(character.x * tile_size + tile_size / 2,
                character.y * tile_size + tile_size / 2,
                radius, 0, 2 * Math.PI,
                !transition.invert_shape);
            mask_ctx.fill();

            mask_ctx.globalCompositeOperation = 'source-over';

            global_ctx.drawImage(mask_ctx.canvas, 0, 0);
        }

        global_ctx.restore();
    }

    global_ctx.restore();
}

let TIMER_SEGMENT_WIDTH = 16;
let TIMER_SEGMENT_HEIGHT = 8;

function draw_timer(ctx) {
    let mf = character.move_fraction;
    let amt_over = Math.floor(TIMER_SEGMENT_WIDTH * (mf + frame_ten_timer));
    let remainder_amt = TIMER_SEGMENT_WIDTH - amt_over;

    for (let i = 0; i < 10; i++) {
        if (i == current_timestep) {
            ctx.drawImage(timer_img,
                TIMER_SEGMENT_WIDTH * i, 0, amt_over, TIMER_SEGMENT_HEIGHT,
                TIMER_SEGMENT_WIDTH * i, level_h * tile_size, amt_over, TIMER_SEGMENT_HEIGHT);

            ctx.drawImage(timer_img,
                TIMER_SEGMENT_WIDTH * i + amt_over, TIMER_SEGMENT_HEIGHT, remainder_amt, TIMER_SEGMENT_HEIGHT,
                TIMER_SEGMENT_WIDTH * i + amt_over, level_h * tile_size, remainder_amt, TIMER_SEGMENT_HEIGHT);
        } else if (i == current_timestep + 1 || i == 0 && current_timestep == 9 && won_level) {
            ctx.drawImage(timer_img,
                TIMER_SEGMENT_WIDTH * i, TIMER_SEGMENT_HEIGHT, amt_over, TIMER_SEGMENT_HEIGHT,
                TIMER_SEGMENT_WIDTH * i, level_h * tile_size, amt_over, TIMER_SEGMENT_HEIGHT);

            ctx.drawImage(timer_img,
                TIMER_SEGMENT_WIDTH * i + amt_over, 0, remainder_amt, TIMER_SEGMENT_HEIGHT,
                TIMER_SEGMENT_WIDTH * i + amt_over, level_h * tile_size, remainder_amt, TIMER_SEGMENT_HEIGHT);
        } else {
            ctx.drawImage(timer_img,
                TIMER_SEGMENT_WIDTH * i, 0, TIMER_SEGMENT_WIDTH, TIMER_SEGMENT_HEIGHT,
                TIMER_SEGMENT_WIDTH * i, level_h * tile_size, TIMER_SEGMENT_WIDTH, TIMER_SEGMENT_HEIGHT);
        }
    }
}

let MESSAGE_WIDTH = 160;
let MESSAGE_HEIGHT = 12;

function draw_message(ctx) {
    ctx.drawImage(msg_img,
        0, MESSAGE_HEIGHT * message_state, MESSAGE_WIDTH, MESSAGE_HEIGHT,
        1, level_h * tile_size - MESSAGE_HEIGHT - 1, MESSAGE_WIDTH, MESSAGE_HEIGHT);
}

function draw_level(ctx) {
    for (let i = 0; i < level.map.length; i++) {
        let x = i % level_w;
        let y = Math.floor(i / level_w);
        let tile = level.map[i];
        ctx.drawImage(tiles_img,
            tile * tile_size, tile_frame * tile_size, tile_size, tile_size,
            x * tile_size, y * tile_size, tile_size, tile_size);
    }
}

function draw_objs(ctx) {
    let sorted_objects = [];
    for (let o of get_current_objs()) {
        sorted_objects.push(o);
    }
    sorted_objects.sort((a, b) => {
        if (a.y > b.y) {
            return 1;
        } else if (a.y < b.y) {
            return -1;
        } else {
            return 0;
        }
    });

    for (let i = 0; i < sorted_objects.length; i++) {
        let o = sorted_objects[i];
        let mf = character.move_fraction; // <- Not a mistake! We want everything to move in sync.

        if (mf == 0 && o.just_reversed) {
            /* Don't draw 'just-reversed' objects when we are
             * standing still, because they should disappear
             * after they move (they collide with each other) */
            continue;
        }

        if (paradox && !paradox_state && o.paradoxical) {
            /* Paradox state = true means we flash to the offending object.
             * Paradox state = false means we show the character. */
            continue;
        }

        if ((game_state === State.MOVE && mf > 0.4 || frame_ten_timer > 0.4) && o.id === objID.star) {
            /* Don't draw stars while we move, because they should only
             * appear momentarily. */
            continue;
        }

        let x = o.x;
        let tx = o.x;
        let y = o.y;
        let ty = o.y;
        if (o.target_x) {
            tx = o.target_x;
        }
        if (o.target_y) {
            ty = o.target_y;
        }

        if (reversed) {
            /* Everything moves backwards when moving in reverse time --
             * we move from the target location to the start. */
            [x, tx, y, ty] = [tx, x, ty, y];
            mf = 1 - mf;
            //if (game_state == State.MOVE) mf = 1 - mf;
        }
        if (o.direction) {
            switch (o.direction) {
                case 'left':  o.frame = 0; break;
                case 'down':  o.frame = 1; break;
                case 'right': o.frame = 2; break;
                case 'up':    o.frame = 3; break;
            }
        }
        ctx.save();
        if (o.hasOwnProperty('alpha')) {
            ctx.globalAlpha = o.alpha;
        }
        ctx.drawImage(objs_img,
            o.id * obj_offsets.w, o.frame * obj_offsets.h, obj_offsets.w, obj_offsets.h,
            (x * (1 - mf) + tx * mf) * tile_size - obj_offsets.offset_x,
            (y * (1 - mf) + ty * mf) * tile_size - obj_offsets.offset_y,
            obj_offsets.w, obj_offsets.h);
        ctx.restore();
    }
}

function draw_character(ctx) {
    if (paradox && paradox_state) {
        /* Paradox state = true means we flash to the offending object.
         * Paradox state = false means we show the character. */
        return;
    }

    if (won_level) {
        /* We don't draw the character when we are in the winning state. */
        return;
    }

    let mf = character.move_fraction;
    let x = character.x;
    let y = character.y;
    let tx = character.target_x;
    let ty = character.target_y;

    let char_frame = 0;
    switch (character.direction) {
        case 'left':    char_frame = 0; break;
        case 'down':    char_frame = 1; break;
        case 'right':   char_frame = 2; break;
        case 'up':      char_frame = 3; break;
    }

    let spritesheet_x = 0;
    if (reversed) {
        spritesheet_x = 1;
    }

    ctx.drawImage(character_img,
        spritesheet_x * char_offsets.w, char_frame * char_offsets.h,
        char_offsets.w, char_offsets.h,
        (x * (1 - mf) + tx * mf) * tile_size - char_offsets.offset_x,
        (y * (1 - mf) + ty * mf) * tile_size - char_offsets.offset_y,
        char_offsets.w, char_offsets.h);
}

function draw_transition_dot_mask(ctx) {
    ctx.fillStyle = '#0000ff';
    let cell_width = canvas_w / transition.w;
    let cell_height = canvas_h / transition.h;
    let max_radius = 0.75 * Math.max(cell_width, cell_height);

    for (let x = -1; x < transition.w + 1; x++) {
        for (let y = -1; y < transition.h + 1; y++) {
            let radius;

            let circle_start_time = (x + y) / (transition.w + transition.h) * (DOT_TRANSITION_LENGTH - TRANSITION_DOT_LENGTH);
            if (transition.timer - circle_start_time < 0) {
                if (transition.invert_shape) {
                    radius = 0;
                } else {
                    radius = max_radius;
                }
            } else if (transition.timer - circle_start_time < TRANSITION_DOT_LENGTH) {
                if (transition.invert_shape) {
                    radius = (transition.timer - circle_start_time) / TRANSITION_DOT_LENGTH * max_radius;
                } else {
                    radius = (1 - (transition.timer - circle_start_time) / TRANSITION_DOT_LENGTH) * max_radius;
                }
            } else {
                if (transition.invert_shape) {
                    radius = max_radius;
                } else {
                    radius = 0;
                }
            }

            let draw_x = x;
            let draw_y = y;
            if (transition.dir_invert_v) draw_x = transition.w - 1 - x;
            if (transition.dir_invert_h) draw_y = transition.h - 1 - y;

            if (radius >= max_radius * 0.8) {
                if (!transition.invert_shape) {
                    ctx.fillRect(draw_x * cell_width, draw_y * cell_width, cell_width + 1, cell_width + 1);
                }
            } else if (radius > 0) {
                ctx.save();
                ctx.beginPath();
                if (transition.invert_shape) {
                    ctx.rect(draw_x * cell_width, draw_y * cell_width, cell_width + 3, cell_width + 3);
                }
                ctx.moveTo(draw_x * cell_width + cell_width / 2, draw_y * cell_width + cell_width / 2);
                ctx.arc(draw_x * cell_width + cell_width / 2,
                         draw_y * cell_width + cell_width / 2,
                         radius, 0, 2 * Math.PI, transition.invert_shape);
                ctx.clip();
                ctx.fillRect(draw_x * cell_width, draw_y * cell_width, cell_width, cell_width);
                ctx.restore();
            } else {
                if (transition.invert_shape) {
                    ctx.fillRect(draw_x * cell_width, draw_y * cell_width, cell_width + 3, cell_width + 3);
                }
            }
        }
    }
}
