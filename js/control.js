class Control {
  constructor(cnv) {
    this.cnv = cnv;
    this.mode = "CTRL";
    this.ctx = cnv.getContext('2d');
    this.channel = new Array(4).fill(0);
    this.font = "Consolas";

    this.protocol = "off";
    this.inputs = {};
    this.inputs["up"]  = {name:"up", posx:0,posy:0,x:0,y:0,r:0,normx:0,normy:0,minx:-1000,maxx:1000,stepx:1000,miny:-1000,maxy:1000,stepy:1000,hold:false,vibrate:false,visible:true,dispName:true,dispVal:false, pressed: false};
    this.inputs["left"]   = {name:"left",posx:0,posy:0,x:0,y:0,r:0,normx:0,normy:1,minx:0    ,maxx:0   ,stepx:0   ,miny:1    ,maxy:2   ,stepy:1   ,hold:true ,vibrate:true ,visible:true,dispName:true,dispVal:true, pressed: false};
    this.inputs["down"]   = {name:"down",posx:0,posy:0,x:0,y:0,r:0,normx:0,normy:1,minx:0    ,maxx:0   ,stepx:0   ,miny:1    ,maxy:3   ,stepy:1   ,hold:true ,vibrate:true ,visible:true,dispName:true,dispVal:true, pressed: false};
    this.inputs["right"]   = {name:"right",posx:0,posy:0,x:0,y:0,r:0,normx:0,normy:1,minx:0    ,maxx:0   ,stepx:0   ,miny:1    ,maxy:3   ,stepy:1   ,hold:true ,vibrate:true ,visible:true,dispName:true,dispVal:true, pressed: false};

    for (let key in this.inputs){
      this.inputs[key].prevx = this.inputs[key].normx;
      this.inputs[key].prevy = this.inputs[key].normy;
    }

    this.hold  = false;
    this.initCanvas();

    ['mousedown','touchstart'].forEach( evt =>
       this.cnv.addEventListener(evt, this.handleEvents.bind(this), false));

    // Update screen if new data
    telemetry.addEventListener("update", this.updateScreen.bind(this), false);
  }

  handleEvents(event){
    event.preventDefault();

    if (!this.hold){
      this.initPos();
    }

    let coordinates = [];
    switch (event.type){
      case "mousedown":
        this.clicked = true;
      case "mousemove":
        if (this.clicked){
          let rect = event.target.getBoundingClientRect();
          coordinates.push([event.clientX - rect.left,event.clientY - rect.top]);
        }
        break;
      case "mouseup":
        this.clicked = false;
        break;
      case "touchstart":
      case "touchmove":
      case "touchend":
        for (let i = 0; i< event.touches.length;i++){
          let rect = event.touches[i].target.getBoundingClientRect();
          coordinates.push([event.touches[i].clientX - rect.left,event.touches[i].clientY - rect.top]);
        }
        break;
    }

    // Process events
    for (let j= 0; j < coordinates.length;j++){
      let [x,y] = coordinates[j];
      let found = false;
      for (let key in this.inputs){
        let distance = this.calcDistance(x,y,this.inputs[key].posx,this.inputs[key].posy);
        this.inputs[key].pressed = distance < this.inputs[key].r && !this.inputs[key].pressed;
      }
    }

    if (this.mode == "CTRL"){
      for (let key in this.inputs){
        // Calculate normalized value
        this.inputs[key].normx = Math.round(this.map(this.inputs[key].x,this.inputs[key].posx-this.inputs[key].r,this.inputs[key].posx+this.inputs[key].r,this.inputs[key].minx,this.inputs[key].maxx));
        this.inputs[key].normy = Math.round(this.map(this.inputs[key].y,this.inputs[key].posy+this.inputs[key].r,this.inputs[key].posy-this.inputs[key].r,this.inputs[key].miny,this.inputs[key].maxy));

        // If value changed, vibrate (switches)
        if (this.inputs[key].vibrate){
          if ((this.inputs[key].prevx != this.inputs[key].normx) ||
              (this.inputs[key].prevy != this.inputs[key].normy)){
              navigator.vibrate([100]);
          }
        }

        this.inputs[key].prevx = this.inputs[key].normx;
        this.inputs[key].prevy = this.inputs[key].normy;
      }
    }

    this.mixer();
    this.display();
  }

  mixer(){

    // Initialize values
    for(let i=0;i<this.channel.length;i++){
      this.channel[i] = 0;
    }

    let i = 0;
    for(let key in this.inputs){
      this.channel[i] = this.getValue(this.inputs[key]);
      i++;
    }
  }

  getSteer(){
    // Returns input object for steer depending on mixer setting
    // return this.inputs.JOY1;
   return {normx: 0, normy: 0};
  }
  getSpeed(){
    // Returns input object for speed depending on mixer setting
    // return this.inputs.JOY1;
    return {normx: 0, normy: 0};
  }

  getValue(input){
    // return input value for specific axis
    return input.pressed ? 1 : 0;
  }

  getValText(input){
    return this.valToText(input,this.getValue(input));
  }

  valToText(input,val){
    // Translate value to corresponding text if available
    if (input.values === undefined || input.values[val] === undefined){
      return val;
    }else{
      return input.values[val];
    }
  }

  initPos(){
    for (let key in this.inputs){
      if (!this.inputs[key].hold){
        this.inputs[key].x = this.inputs[key].posx;
        this.inputs[key].y = this.inputs[key].posy;
      }
    }
  }

  setPos(){
    // Set input position depending on the value
    for (let key in this.inputs){
      let r1 = this.inputs[key].r; // outer circle
      let r6 = r1 * 0.2; // knob

      this.inputs[key].x = (this.inputs[key].minx == this.inputs[key].maxx)?this.inputs[key].posx:this.map(this.inputs[key].normx,this.inputs[key].minx,this.inputs[key].maxx,this.inputs[key].posx-r1+r6,this.inputs[key].posx+r1-r6);
      this.inputs[key].y = (this.inputs[key].miny == this.inputs[key].maxy)?this.inputs[key].posy:this.map(this.inputs[key].normy,this.inputs[key].maxy,this.inputs[key].miny,this.inputs[key].posy-r1+r6,this.inputs[key].posy+r1-r6);
    }
  }

  calcDistance(x1,y1,x2,y2){
    return Math.sqrt(Math.pow(x1 - x2, 2) +
                     Math.pow(y1 - y2, 2));
  }

  resizeCanvas(){
    let oldWidth = this.cnv.width;
    let oldHeight = this.cnv.height;

    this.cnv.width = this.cnv.parentElement.clientWidth;
    this.cnv.height = this.cnv.parentElement.clientHeight;

    // Recalculate inputs coordinates and size
    for( let key in this.inputs){
      this.inputs[key].posx = this.map(this.inputs[key].posx,0,oldWidth,0,this.cnv.width);
      this.inputs[key].posy = this.map(this.inputs[key].posy,0,oldHeight,0,this.cnv.height);
      this.inputs[key].r    = this.map(this.inputs[key].r   ,0,oldWidth,0,this.cnv.width);
    }

    // Recalculate screen coordinates and size
    this.screeny1 = this.map(this.screeny1,0,oldHeight,0,this.cnv.height);
    this.screenHeight1 = this.map(this.screenHeight1,0,oldHeight,0,this.cnv.height);
    this.screenx1 = this.map(this.screenx1,0,oldWidth,0,this.cnv.width);
    this.screenWidth1 = this.map(this.screenWidth1,0,oldWidth,0,this.cnv.width);

    this.setPos();
    this.display();
  }

  initCanvas(){
    this.cnv.width= this.cnv.parentElement.clientWidth;
    this.cnv.height= this.cnv.parentElement.clientHeight;

    let switchr = Math.max(this.cnv.height,this.cnv.width)/ 50;
    let size = switchr * 4 * 2 * 2;

    this.landscape = {
      inputs:{
        left:{posx:this.cnv.width / 6 - this.cnv.height / 4,
          posy:5 * this.cnv.height / 8,
          r:this.cnv.height / 6,
          visible:true},
        right:{posx:this.cnv.width / 6 + this.cnv.height / 4,
          posy:5 * this.cnv.height / 8,
          r:this.cnv.height / 6,
          visible:true},
        up:{posx:this.cnv.width / 6,
          posy:5 * this.cnv.height / 8  - this.cnv.height / 4,
          r:this.cnv.height / 6,
          visible:true},
        down:{posx:this.cnv.width / 6,
          posy:5 * this.cnv.height / 8 + this.cnv.height / 4,
          r:this.cnv.height / 6,
          visible:true},
      },
      screenx1:(this.cnv.width - this.cnv.width / 3) /2,
      screeny1:this.cnv.height / 1.75,
      screenWidth1:this.cnv.width / 3,
      screenHeight1:this.cnv.height / 3,
    };

    this.setValues(this,this.landscape);

    this.setPos();
    this.display();
  }

  setValues(input,dict){
    for(let key in dict){
      if (typeof dict[key] === "object"){
        if (!(key in input )) input[key] = {};
        this.setValues(input[key],dict[key]);
      }else{
        input[key] = dict[key];
      }
    }
  }

  display(){
    // Case
    let gradient = this.ctx.createLinearGradient(0, this.cnv.height, this.cnv.width, this.cnv.height);
    gradient.addColorStop(0, 'lightgrey');
    gradient.addColorStop(0.4, 'grey');
    gradient.addColorStop(0.6, 'grey');
    gradient.addColorStop(1, 'lightgrey');
    this.ctx.fillStyle = gradient;
    this.ctx.fillRect(0, 0, this.cnv.width, this.cnv.height);

    // Display inputs
    for(let key in this.inputs){
      if (this.inputs[key].visible) this.displayJoystick(this.inputs[key]);
    }

    // Display Screen
    this.updateScreen();
  }

  updateScreen(){

    this.screenWidth2 = this.screenWidth1 * 0.9;
    this.screenHeight2 = this.screenHeight1 * 0.85;
    this.screenx2 = this.screenx1 + (this.screenWidth1 - this.screenWidth2) /2;
    this.screeny2 = this.screeny1 + (this.screenHeight1 - this.screenHeight2) /2;


     // Screen outer rectangle
     this.ctx.fillStyle = "black";
     this.ctx.fillRect(this.screenx1,this.screeny1,this.screenWidth1,this.screenHeight1);

     // Screen inner rectangle
     this.ctx.fillStyle = "turquoise";
     this.ctx.fillRect(this.screenx2,this.screeny2,this.screenWidth2,this.screenHeight2);

     // text
     let fontsize = Math.round(this.screenWidth2 / 20);
     this.ctx.font =  fontsize+"px "+this.font;
     this.ctx.fillStyle = "blue";
     this.ctx.textAlign = "left";
     // this.ctx.fillText("Steer", this.screenx2 + fontsize, this.screeny2 + fontsize);
     // this.ctx.fillText("Speed", this.screenx2 + fontsize, this.screeny2 + fontsize*2);

     let line = 1;
     for (let key in this.inputs){
      this.ctx.textAlign = "left";
      this.ctx.fillText(this.inputs[key].name , this.screenx2 + fontsize, this.screeny2 + fontsize*line);
      this.ctx.textAlign = "right";
      this.ctx.fillText(this.getValText(this.inputs[key],"y") , this.screenx2 + fontsize*7, this.screeny2 + fontsize*line);
      line++;
    }

     // Values
     this.ctx.textAlign = "right";
     // this.ctx.fillText(this.getSteer().normx, this.screenx2 + fontsize * 7, this.screeny2 + fontsize);
     // this.ctx.fillText(this.getSpeed().normy, this.screenx2 + fontsize * 7, this.screeny2 + fontsize*2);
     this.ctx.fillText(telemetry.batV + "V", this.screenx2 + this.screenWidth2 - fontsize, this.screeny2 + fontsize);
     this.ctx.fillText(telemetry.temp + "°", this.screenx2 + this.screenWidth2 - fontsize, this.screeny2 + fontsize*2);
  }

  displayJoystick(input){
    let r1 = input.r; // outer circle
    let r3 = r1 * 0.8; // inner circle
    let r6 = r1 * 0.2; // knob

    // Initial position
    let posx = input.posx;
    let posy = input.posy;

    // Current position
    let x = input.x;
    let y = input.y;

    let fontsize = 0;
    fontsize = this.cnv.width / 100;

    // if (input.dispName){
    //   this.ctx.font = fontsize+"px "+this.font;
    //   this.ctx.textAlign = "center";
    //   this.ctx.fillStyle = "#000";
    //   this.ctx.fillText(input.name, input.posx, input.posy - r8);
    // }

    if (this.mode == "EDIT"){
      this.ctx.beginPath();
      this.ctx.fillStyle = "red";
      this.ctx.lineWidth = 2;
      this.ctx.arc(posx, posy, r1*2, 0, 2 * Math.PI, false);
      this.ctx.closePath();
      this.ctx.fill();
    }

    let gradient = this.ctx.createLinearGradient(posx - r1, posy + r1, posx + r1, posy - r1);
    gradient.addColorStop(0, 'white');
    gradient.addColorStop(1, 'black');

    let gradient1 = this.ctx.createLinearGradient(posx - r1, posy + r1, posx + r1, posy - r1);
    gradient1.addColorStop(0, 'black');
    gradient1.addColorStop(1, 'white');

    // if (input.dispVal){
    //   if (input.minx != input.maxx){
    //     for(let i = input.minx;i <= input.maxx; i+=input.stepx){
    //       let textx = (input.minx == input.maxx)?posx:this.map(i,input.maxx,input.minx,posx-r1+r6,posx+r1-r6);
    //       let texty = posy + r8;
    //       this.ctx.font = fontsize + "px MuseoSans_900-webfont";
    //       this.ctx.textAlign = "left";
    //       this.ctx.fillStyle = "#000";
    //       this.ctx.fillText(this.valToText(input,i), textx, texty);
    //     }
    //   }
    //
    //   if (input.miny != input.maxy){
    //     for(let i = input.miny;i <= input.maxy; i+=input.stepy){
    //       let textx = posx + r8;
    //       let texty = (input.miny == input.maxy)?posy:this.map(i,input.maxy,input.miny,posy-r1+r6,posy+r1-r6);
    //       this.ctx.font = fontsize + "px MuseoSans_900-webfont";
    //       this.ctx.textAlign = "left";
    //       this.ctx.fillStyle = "#000";
    //       this.ctx.fillText(this.valToText(input,i), textx, texty);
    //     }
    //   }
    // }

    // Knob position
    let x3 = (input.minx == input.maxx)?posx:this.map(input.normx,input.minx,input.maxx,posx-r1+r6,posx+r1-r6);
    let y3 = (input.miny == input.maxy)?posy:this.map(input.normy,input.maxy,input.miny,posy-r1+r6,posy+r1-r6);

    // Outer ring - doesn't move
    this.ctx.beginPath();
    this.ctx.strokeStyle = gradient;
    this.ctx.fillStyle = gradient;
    this.ctx.arc(posx, posy, r1, 0, 2 * Math.PI, false);
    this.ctx.closePath();
    this.ctx.fill();


    // Knob basis position
    let x2 = (input.minx == input.maxx)?posx:this.map(x,posx-r1+r6,posx+r1-r6,posx-r3+r6,posx+r3-r6);
    let y2 = (input.miny == input.maxy)?posy:this.map(y,posy-r1+r6,posy+r1-r6,posy-r3+r6/2,posy+r3-r6/2);

    // // Outer circle - doesn't move
    // this.ctx.fillStyle = "black";
    // this.ctx.fillRect(posx,posy,r1*2,r1*2);

    // Inner circle - can move vertically
    this.ctx.beginPath();
    this.ctx.fillStyle = "black";
    this.ctx.arc(posx,posy,r3, 0, 2 * Math.PI, false);
    this.ctx.closePath();
    this.ctx.fill();

    if(input.pressed) {
      this.ctx.beginPath();
      this.ctx.fillStyle = "red";
      this.ctx.arc(posx,posy,r6, 0, 2 * Math.PI, false);
      this.ctx.closePath();
      this.ctx.fill();
    }
  }

  clamp(val, min, max) {
    return val > max ? max : val < min ? min : val;
  }

  map(x, in_min, in_max, out_min, out_max) {
    return this.clamp((x - in_min) * (out_max - out_min) / (in_max - in_min) + out_min, out_min,out_max);
  }
}
