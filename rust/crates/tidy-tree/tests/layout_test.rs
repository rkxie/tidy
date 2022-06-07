use std::ptr::NonNull;

mod aesthetic_rules;
use rand::prelude::*;
use tidy_tree::{geometry::Coord, BasicLayout, Layout, Node, TidyLayout};

pub fn test_layout(layout: &mut dyn Layout) {
    let mut rng = StdRng::seed_from_u64(1001);
    for _ in 0..100 {
        let mut tree = gen_tree(&mut rng, 500);
        layout.layout(&mut tree);
        aesthetic_rules::assert_no_overlap_nodes(&tree);
        aesthetic_rules::assert_no_crossed_lines(&tree);
        aesthetic_rules::check_nodes_order(&tree);
        aesthetic_rules::check_y_position_in_same_level(&tree);
        aesthetic_rules::assert_parent_centered(&tree);
        aesthetic_rules::assert_symmetric(&tree, layout);
    }
}

pub fn gen_tree(rng: &mut StdRng, num: usize) -> Node {
    let root = gen_node(rng);
    let mut nodes: Vec<NonNull<Node>> = vec![(&root).into()];
    for _ in 0..num {
        let parent_index = rng.gen_range(0..nodes.len());
        let parent = unsafe { nodes[parent_index].as_mut() };
        let node = gen_node(rng);
        parent.append_child(node);
        nodes.push(parent.children.last().unwrap().as_ref().into());
    }

    root
}

fn gen_node(rng: &mut StdRng) -> Node {
    Node {
        id: rng.gen(),
        width: rng.gen_range(1..10) as Coord,
        height: rng.gen_range(1..10) as Coord,
        x: 0.,
        y: 0.,
        relative_x: 0.,
        relative_y: 0.,
        bbox: Default::default(),
        parent: None,
        children: vec![],
        tidy: None,
    }
}

#[test]
fn test_basic_layout() {
    let mut layout = BasicLayout {
        parent_child_margin: 10.,
        peer_margin: 10.,
    };
    test_layout(&mut layout);
}

#[test]
fn test_tidy_layout() {
    let mut layout = TidyLayout::new(10., 10.);
    test_layout(&mut layout);
}

#[test]
fn test_tidy_layout2() {
    let mut tidy = TidyLayout::new(1., 1.);
    let mut root = Node::new(0, 1., 1.);
    let first_child = Node::new_with_child(
        1,
        1.,
        1.,
        Node::new_with_child(10, 2., 1., Node::new(100, 1., 1.)),
    );
    root.append_child(first_child);

    let second = Node::new_with_child(
        2,
        1.,
        1.,
        Node::new_with_child(11, 1., 1., Node::new(101, 1., 1.)),
    );
    root.append_child(second);

    root.append_child(Node::new(3, 1., 2.));
    tidy.layout(&mut root);
    // println!("{}", root.str());
    aesthetic_rules::assert_symmetric(&root, &mut tidy);
}

#[test]
fn test_tidy_layout3() {
    let mut tidy = TidyLayout::new(1., 1.);
    let mut root = Node::new(0, 8., 7.);
    root.append_child(Node::new_with_children(
        1,
        3.,
        9.,
        vec![
            Node::new(10, 3., 8.),
            Node::new(10, 5., 5.),
            Node::new(10, 6., 8.),
        ],
    ));
    root.append_child(Node::new(3, 1., 1.));

    tidy.layout(&mut root);
    // println!("{}", root.str());
    aesthetic_rules::assert_no_overlap_nodes(&root);
    aesthetic_rules::assert_symmetric(&root, &mut tidy);
}
